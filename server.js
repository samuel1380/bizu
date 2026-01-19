import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// --- CONFIGURAÇÃO DO AMBIENTE ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_GEMINI_MODEL_FALLBACK_LIST = [
  "gemini-1.5-flash",       
  "gemini-2.0-flash",       
  "gemini-1.5-pro",         
  "gemini-3-flash-preview", 
  "gemini-1.5-flash-8b"     // Opção ultra-leve
];

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30_000);
const AI_MAX_CONCURRENCY = Math.max(1, Number(process.env.AI_MAX_CONCURRENCY || 4));

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// --- HELPERS DE PARSEAMENTO ROBUSTO ---

/**
 * Tenta extrair um JSON válido de qualquer string de texto.
 * Funciona mesmo se a IA responder "Aqui está o seu JSON: { ... }"
 */
function extractJSON(text) {
  if (!text) return "{}";

  // 1. Tenta limpar blocos de código markdown
  let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

  // 2. Se já parecer JSON, retorna
  if ((cleanText.startsWith('{') && cleanText.endsWith('}')) || 
      (cleanText.startsWith('[') && cleanText.endsWith(']'))) {
    return cleanText;
  }

  // 3. Regex para encontrar o primeiro objeto {} ou array []
  const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // 4. Fallback: retorna o texto original limpo (pode falhar no JSON.parse, mas tentamos)
  return cleanText;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseEnvList(value) {
  if (!value) return [];
  return value
    .split(/[,\n]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return "";
}

function isLikelyApiKey(value) {
  if (!value) return false;
  const trimmed = value.trim();
  return /^sk-[A-Za-z0-9_\-]{10,}$/.test(trimmed) || /^AIza[0-9A-Za-z_\-]{20,}$/.test(trimmed);
}

class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.running = 0;
    this.queue = [];
  }

  acquire() {
    return new Promise(resolve => {
      const tryAcquire = () => {
        if (this.running < this.maxConcurrency) {
          this.running += 1;
          resolve(() => {
            this.running -= 1;
            const next = this.queue.shift();
            if (next) next();
          });
          return;
        }
        this.queue.push(tryAcquire);
      };
      tryAcquire();
    });
  }
}

const aiSemaphore = new Semaphore(AI_MAX_CONCURRENCY);

function getProviderCandidates() {
  const providers = parseEnvList(process.env.AI_PROVIDERS || process.env.AI_PROVIDER || "gemini");

  return providers.map((p) => {
    const provider = (p || "").toLowerCase();

    if (provider === "gemini" || provider === "google") {
      const apiKeys = [
        ...parseEnvList(process.env.GEMINI_API_KEYS),
        ...parseEnvList(process.env.AI_API_KEYS),
        firstNonEmpty(process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY, process.env.API_KEY),
      ].filter(Boolean);
      return { provider: "gemini", apiKeys };
    }

    if (provider === "openai" || provider === "openai_compatible" || provider === "compatible") {
      const apiKeys = [
        ...parseEnvList(process.env.OPENAI_API_KEYS),
        ...parseEnvList(process.env.AI_API_KEYS),
        firstNonEmpty(process.env.OPENAI_API_KEY, process.env.API_KEY),
      ].filter(Boolean);
      const baseUrl = firstNonEmpty(process.env.AI_BASE_URL, process.env.OPENAI_BASE_URL, "https://api.openai.com/v1");
      return { provider: "openai", apiKeys, baseUrl };
    }

    return { provider, apiKeys: [] };
  });
}

function getModelCandidates(provider) {
  const explicitFallback = parseEnvList(process.env.AI_MODEL_FALLBACK);
  const envModel = process.env.AI_MODEL && !isLikelyApiKey(process.env.AI_MODEL) ? process.env.AI_MODEL : "";

  if (explicitFallback.length > 0) {
    const models = explicitFallback;
    if (envModel) {
      return [envModel, ...models.filter(m => m !== envModel)];
    }
    return models;
  }

  if (provider === "gemini") {
    if (envModel) {
      return [envModel, ...DEFAULT_GEMINI_MODEL_FALLBACK_LIST.filter(m => m !== envModel)];
    }
    return [...DEFAULT_GEMINI_MODEL_FALLBACK_LIST];
  }

  return [envModel || "gpt-4o-mini"];
}

function isQuotaOrRateLimitError(error) {
  const status = error?.status;
  const msg = (error?.message || "").toString();
  return status === 429 || msg.includes("429") || msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate limit");
}

function isModelNotFoundError(error) {
  const status = error?.status;
  const msg = (error?.message || "").toString();
  return status === 404 || msg.includes("404") || msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("model");
}

function isAuthError(error) {
  const status = error?.status;
  const msg = (error?.message || "").toString();
  return status === 401 || status === 403 || msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("forbidden");
}

function createGeminiProvider(apiKey) {
  const ai = new GoogleGenAI({ apiKey });
  return {
    provider: "gemini",
    async generateText({ model, prompt, systemInstruction }) {
      const finalPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
      const response = await ai.models.generateContent({
        model,
        contents: finalPrompt,
        config: { safetySettings: SAFETY_SETTINGS }
      });
      return response.text || "";
    },
    async generateJson({ model, prompt, systemInstruction }) {
      const finalPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
      const response = await ai.models.generateContent({
        model,
        contents: finalPrompt,
        config: {
          responseMimeType: "application/json",
          safetySettings: SAFETY_SETTINGS
        }
      });
      return JSON.parse(extractJSON(response.text));
    },
    async chat({ model, systemInstruction, history, message }) {
      const limitedHistory = (history || []).slice(-6);
      const chat = ai.chats.create({
        model,
        history: limitedHistory,
        config: {
          systemInstruction,
          safetySettings: SAFETY_SETTINGS
        }
      });
      const result = await chat.sendMessage({ message });
      return result.text || "";
    }
  };
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg = (json?.error?.message || json?.message || text || `HTTP ${res.status}`).toString();
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timeoutId);
  }
}

function toOpenAIMessages(history, systemInstruction, userMessage) {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  for (const h of (history || []).slice(-6)) {
    const role = h?.role === "user" ? "user" : "assistant";
    const content = (h?.parts || []).map(p => p?.text).filter(Boolean).join("\n");
    if (content) messages.push({ role, content });
  }

  if (userMessage) {
    messages.push({ role: "user", content: userMessage });
  }

  return messages;
}

function createOpenAICompatibleProvider(apiKey, baseUrl) {
  const normalizedBaseUrl = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  return {
    provider: "openai",
    async generateText({ model, prompt, systemInstruction }) {
      const messages = toOpenAIMessages([], systemInstruction, prompt);
      const body = {
        model,
        messages
      };
      const json = await fetchJsonWithTimeout(
        `${normalizedBaseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(body)
        },
        AI_TIMEOUT_MS
      );
      return json?.choices?.[0]?.message?.content || "";
    },
    async generateJson({ model, prompt, systemInstruction }) {
      const text = await this.generateText({ model, prompt, systemInstruction });
      return JSON.parse(extractJSON(text));
    },
    async chat({ model, systemInstruction, history, message }) {
      const messages = toOpenAIMessages(history, systemInstruction, message);
      const body = {
        model,
        messages
      };
      const json = await fetchJsonWithTimeout(
        `${normalizedBaseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(body)
        },
        AI_TIMEOUT_MS
      );
      return json?.choices?.[0]?.message?.content || "";
    }
  };
}

function createProviderClient(providerCandidate, apiKey) {
  if (providerCandidate.provider === "gemini") {
    return createGeminiProvider(apiKey);
  }
  if (providerCandidate.provider === "openai") {
    return createOpenAICompatibleProvider(apiKey, providerCandidate.baseUrl);
  }
  throw new Error(`Provider não suportado: ${providerCandidate.provider}`);
}

async function runWithFallback(actionCallback) {
  const providers = getProviderCandidates();
  if (providers.length === 0) {
    throw new Error("Nenhum provider configurado (AI_PROVIDER/AI_PROVIDERS).");
  }

  let lastError;

  for (const providerCandidate of providers) {
    const keys = providerCandidate.apiKeys || [];
    if (keys.length === 0) continue;

    for (const apiKey of keys) {
      const client = createProviderClient(providerCandidate, apiKey);
      const models = getModelCandidates(providerCandidate.provider);

      for (const model of models) {
        try {
          return await actionCallback({ client, model, provider: providerCandidate.provider });
        } catch (error) {
          lastError = error;

          if (isQuotaOrRateLimitError(error)) {
            await sleep(750);
            continue;
          }

          if (isModelNotFoundError(error)) {
            continue;
          }

          if (isAuthError(error)) {
            break;
          }

          throw error;
        }
      }
    }
  }

  if (lastError?.message?.includes("API_KEY_MISSING")) {
    throw lastError;
  }

  throw lastError || new Error("Falha ao chamar a IA. Verifique provider, modelo e API key.");
}

// --- AÇÕES ---

async function handleGenerateQuiz(client, modelName, { topic, difficulty, numberOfQuestions }) {
  const prompt = `Você é um gerador de questões JSON.
  Tarefa: Criar ${numberOfQuestions} questões sobre "${topic}" (${difficulty}).
  
  IMPORTANTE: Responda APENAS com o JSON puro. Sem introduções.
  
  Schema obrigatório:
  [
    {
      "id": "uuid",
      "text": "Enunciado da questão",
      "options": ["Alternativa A", "B", "C", "D", "E"],
      "correctAnswerIndex": 0,
      "explanation": "Explicação breve"
    }
  ]`;

  return await client.generateJson({ model: modelName, prompt });
}

async function handleAskTutor(client, modelName, { history, message }) {
  const text = await client.chat({
    model: modelName,
    systemInstruction: "Você é o BizuBot, um mentor de concursos. Responda de forma direta, motivadora e use Markdown (negrito, listas).",
    history,
    message
  });

  if (!text || text.trim() === "") {
    return { text: "⚠️ A IA recebeu sua mensagem mas não gerou texto. Tente reformular." };
  }

  return { text };
}

async function handleGenerateMaterials(client, modelName, { count }) {
  const prompt = `Liste ${count} materiais de estudo sobre concursos.
  Format: JSON Array.
  Types: "PDF" ou "ARTICLE". (NO VIDEO).
  
  Schema:
  [
    {
      "title": "Título do Material",
      "category": "Matéria",
      "type": "PDF",
      "duration": "10 pág",
      "summary": "Resumo breve"
    }
  ]`;

  return await client.generateJson({ model: modelName, prompt });
}

async function handleGenerateMaterialContent(client, modelName, { material }) {
  const prompt = `Gere o conteúdo completo de uma apostila/artigo sobre: "${material.title}".
  Use Markdown.
  Estrutura:
  - Introdução
  - Tópicos Principais (Detalhados)
  - Exemplos
  - Conclusão`;
  
  const content = await client.generateText({ model: modelName, prompt });
  return { content };
}

async function handleGenerateRoutine(client, modelName, { targetExam, hours, subjects }) {
  const prompt = `Crie uma rotina de estudos JSON para ${targetExam} (${hours}h/dia).
  Foco: ${subjects}.
  
  Schema:
  {
    "weekSchedule": [
      {
        "day": "Segunda-feira",
        "focus": "Matéria Principal",
        "tasks": [
          { "subject": "Matéria", "activity": "Teoria/Questões", "duration": "1h" }
        ]
      }
    ]
  }`;

  return await client.generateJson({ model: modelName, prompt });
}

async function handleUpdateRadar(client, modelName) {
  const prompt = `Liste 5 concursos públicos brasileiros em destaque recentemente.
  JSON Array.
  Schema:
  [{"institution":"Nome","title":"Cargo","forecast":"Previsão","status":"Previsto","salary":"R$","board":"Banca","url":""}]`;

  return await client.generateJson({ model: modelName, prompt });
}

// --- ROTAS ---

app.post('/api/gemini', async (req, res) => {
  const { action, payload } = req.body;
  
  try {
    let result;
    const release = await aiSemaphore.acquire();
    try {
      await runWithFallback(async ({ client, model }) => {
          switch (action) {
              case 'generateQuiz': result = await handleGenerateQuiz(client, model, payload); break;
              case 'askTutor': result = await handleAskTutor(client, model, payload); break;
              case 'generateMaterials': result = await handleGenerateMaterials(client, model, payload); break;
              case 'generateMaterialContent': result = await handleGenerateMaterialContent(client, model, payload); break;
              case 'generateRoutine': result = await handleGenerateRoutine(client, model, payload); break;
              case 'updateRadar': result = await handleUpdateRadar(client, model); break;
              default: throw new Error("Ação inválida");
          }
      });
    } finally {
      release();
    }

    res.json(result);

  } catch (error) {
    console.error(`[Erro API] ${action}:`, error.message);
    
    if (error.message.includes("API_KEY") || error.message.includes("Unauthorized") || error.message.includes("forbidden")) {
      return res.status(500).json({ error: "Chave API inválida ou não configurada (Render env vars)." });
    }
    
    // Tratamento genérico para erros de JSON parse (comum em IAs instáveis)
    if (error instanceof SyntaxError) {
       return res.status(500).json({ error: "A IA gerou uma resposta inválida. Tente novamente." });
    }

    res.status(503).json({ error: "Serviço de IA indisponível. Tente novamente em alguns segundos." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor Universal Bizu rodando na porta ${PORT}`);
});
