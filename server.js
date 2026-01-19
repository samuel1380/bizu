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

// --- LISTA UNIVERSAL DE MODELOS ---
// A ordem aqui define a prioridade.
// 1. gemini-1.5-flash: Maior limite gratuito, extremamente rápido e estável.
// 2. gemini-2.0-flash: Ótimo balanço entre inteligência e velocidade.
// 3. gemini-1.5-pro: Mais inteligente, porém mais lento e com limite menor.
// 4. gemini-3-flash-preview: Experimental (limites baixos, usar com cautela).
const MODEL_FALLBACK_LIST = [
  "gemini-1.5-flash",       
  "gemini-2.0-flash",       
  "gemini-1.5-pro",         
  "gemini-3-flash-preview", 
  "gemini-1.5-flash-8b"     
];

const OPENROUTER_MODELS = [
  "xiaomi/mimo-v2-flash:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.0-flash-001",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.1-8b-instruct",
  "qwen/qwen-2.5-7b-instruct"
];

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

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

  try {
    // 1. Tenta limpar blocos de código markdown
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. Se já parecer JSON puro, retorna
    if ((cleanText.startsWith('{') && cleanText.endsWith('}')) || 
        (cleanText.startsWith('[') && cleanText.endsWith(']'))) {
      return cleanText;
    }

    // 3. Regex para encontrar o primeiro objeto {} ou array []
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return cleanText;
  } catch (e) {
    console.error("Erro ao extrair JSON:", e);
    return "{}";
  }
}

/**
 * Garante que o retorno seja um array, mesmo se a IA envolver em um objeto
 * Ex: { "questions": [...] } -> [...]
 */
function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // Procura por qualquer propriedade que seja um array
    const possibleArray = Object.values(data).find(val => Array.isArray(val));
    if (possibleArray) return possibleArray;
  }
  return [];
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getAI() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const openRouterKey = process.env.OPENAI_API_KEY;
  
  if (!geminiKey && !openRouterKey) {
    throw new Error("API_KEY_MISSING");
  }
  
  return {
    gemini: geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null,
    openRouter: openRouterKey ? {
      apiKey: openRouterKey,
      baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.AI_MODEL || 'google/gemini-2.0-flash-exp:free'
    } : null,
    preferredProvider: process.env.AI_PROVIDER?.toLowerCase() || (geminiKey ? 'gemini' : 'openrouter')
  };
}

// --- CHAMADA OPENROUTER (FALLBACK) ---
async function callOpenRouter(config, prompt, isJson = false, history = null, specificModel = null) {
  const headers = {
    "Authorization": `Bearer ${config.apiKey.trim()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://bizu.app",
    "X-Title": "Bizu App"
  };

  const messages = history ? [...history] : [];
  if (prompt) {
    messages.push({ role: "user", content: prompt });
  }

  const body = {
    model: specificModel || config.model,
    messages: messages,
    response_format: isJson ? { type: "json_object" } : undefined,
    temperature: 0.7
  };

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    const rawText = await response.text();
    
    if (!response.ok) {
      let errorMsg = rawText;
      try {
        const errorData = JSON.parse(rawText || "{}");
        errorMsg = errorData.error?.message || rawText;
      } catch (e) {}
      
      if (response.status === 429) throw new Error(`RATE_LIMIT:${errorMsg}`);
      throw new Error(errorMsg || `Erro OpenRouter: ${response.status}`);
    }

    if (!rawText || rawText.trim() === "") throw new Error("Resposta vazia do OpenRouter");

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error("Resposta inválida do OpenRouter (JSON corrompido)");
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Formato de resposta inesperado do OpenRouter");
    }

    return { text: data.choices[0].message.content || "" };
  } catch (error) {
    throw error;
  }
}

// --- EXECUTOR UNIVERSAL COM MULTI-FALLBACK ---
async function runWithModelFallback(ai, actionName, payload) {
  const providersToTry = ai.preferredProvider === 'gemini' 
    ? ['gemini', 'openrouter'] 
    : ['openrouter', 'gemini'];

  for (const provider of providersToTry) {
    // --- TENTANDO GEMINI ---
    if (provider === 'gemini' && ai.gemini) {
      let modelsToTry = [...MODEL_FALLBACK_LIST];
      if (process.env.AI_MODEL && !process.env.AI_MODEL.includes("/")) {
        modelsToTry = [process.env.AI_MODEL, ...modelsToTry.filter(m => m !== process.env.AI_MODEL)];
      }

      for (const model of modelsToTry) {
        try {
          console.log(`[Gemini] Tentando ${actionName} com ${model}`);
          if (actionName === 'generateQuiz') return await handleGenerateQuiz(ai.gemini, model, payload);
          if (actionName === 'askTutor') return await handleAskTutor(ai.gemini, model, payload);
          if (actionName === 'generateMaterials') return await handleGenerateMaterials(ai.gemini, model, payload);
          if (actionName === 'generateMaterialContent') return await handleGenerateMaterialContent(ai.gemini, model, payload);
          if (actionName === 'generateRoutine') return await handleGenerateRoutine(ai.gemini, model, payload);
          if (actionName === 'updateRadar') return await handleUpdateRadar(ai.gemini, model);
        } catch (error) {
          if (error.message.includes("429") || error.message.includes("Quota")) {
            console.warn(`⚠️ Gemini ${model} limitado. Tentando próximo modelo Gemini...`);
            continue;
          }
          console.error(`❌ Erro no Gemini (${model}):`, error.message);
          break; // Sai do loop de modelos Gemini e tenta o próximo provedor
        }
      }
    }

    // --- TENTANDO OPENROUTER ---
    if (provider === 'openrouter' && ai.openRouter) {
      let models = [ai.openRouter.model, ...OPENROUTER_MODELS.filter(m => m !== ai.openRouter.model)];
      for (const model of models) {
        try {
          console.log(`[OpenRouter] Tentando ${actionName} com ${model}`);
          
          let prompt = "";
          let isJson = false;
          let history = null;

          if (actionName === 'generateQuiz') {
            prompt = `Gere ${payload.numberOfQuestions} questões sobre "${payload.topic}" (${payload.difficulty}). Responda APENAS JSON. Schema: [{id, text, options:[], correctAnswerIndex:number, explanation}]`;
            isJson = true;
          } else if (actionName === 'askTutor') {
            history = (payload.history || []).map(m => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.parts[0].text
            }));
            prompt = payload.message;
          } else if (actionName === 'generateMaterials') {
            prompt = `Você é um Especialista em Concursos. Liste ${payload.count} materiais de estudo de alta qualidade.
            Os materiais devem ser do tipo: "Apostila Completa" ou "Resumo Estratégico".
            JSON Array: [{"title": "Título da Apostila", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas", "summary": "Breve resumo do que será abordado"}]`;
            isJson = true;
          } else if (actionName === 'generateMaterialContent') {
            prompt = `Você é um Professor de Cursinho Preparatório.
            Gere uma APOSTILA ou RESUMO DE ESTUDO completo em Markdown para o tema: "${payload.material.title}".
            
            ESTRUTURA OBRIGATÓRIA:
            1. Título Chamativo (H1)
            2. Introdução ao Tema
            3. Tópicos Detalhados (H2 e H3)
            4. Dicas de Ouro para Concursos (Destaque)
            5. Resumo Final (Bullet points)
            6. Referências ou Base Legal (se houver)
            
            Use Markdown rico: negrito, tabelas, listas e blocos de citação. Foque em clareza e organização para impressão.`;
          } else if (actionName === 'generateRoutine') {
            prompt = `Crie rotina de estudos JSON para ${payload.targetExam} (${payload.hours}h/dia). Foco: ${payload.subjects}. Schema: {weekSchedule:[{day, focus, tasks:[{subject, activity, duration}]}]}`;
            isJson = true;
          } else if (actionName === 'updateRadar') {
            prompt = `Liste 5 concursos previstos. JSON Array: [{institution, title, forecast, status, salary, board, url}]`;
            isJson = true;
          }

          const res = await callOpenRouter(ai.openRouter, prompt, isJson, history, model);
          if (isJson) {
            const parsed = JSON.parse(extractJSON(res.text));
            return actionName === 'generateQuiz' || actionName === 'generateMaterials' || actionName === 'updateRadar' 
              ? ensureArray(parsed) 
              : parsed;
          }
          return actionName === 'generateMaterialContent' ? { content: res.text } : res;
        } catch (error) {
          console.warn(`⚠️ OpenRouter ${model} falhou: ${error.message}. Tentando próximo modelo...`);
          continue;
        }
      }
    }
  }

  throw new Error("Todas as IAs e modelos (Gemini e OpenRouter) atingiram o limite de uso.");
}

// --- AÇÕES ---

async function handleGenerateQuiz(genAI, modelName, { topic, difficulty, numberOfQuestions }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prompt = `Você é um gerador de questões JSON para concursos.
  Tarefa: Criar ${numberOfQuestions} questões sobre "${topic}" (${difficulty}).
  Responda APENAS o JSON.
  Schema: [{"id": "uuid", "text": "enunciado", "options": ["A", "B", "C", "D", "E"], "correctAnswerIndex": 0, "explanation": "porque..."}]`;
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return ensureArray(JSON.parse(extractJSON(text)));
}

async function handleAskTutor(genAI, modelName, { history, message }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: "Você é o BizuBot, um mentor de concursos. Responda de forma direta, motivadora e use Markdown.",
    safetySettings: SAFETY_SETTINGS
  });

  const chat = model.startChat({
    history: (history || []).slice(-6)
  });
  
  const result = await chat.sendMessage(message);
  return { text: result.response.text() };
}

async function handleGenerateMaterials(genAI, modelName, { count }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prompt = `Você é um Especialista em Concursos. Liste ${count} materiais de estudo de alta qualidade.
  Os materiais devem ser do tipo: "Apostila Completa" ou "Resumo Estratégico".
  JSON Array: [{"title": "Título da Apostila", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas", "summary": "Breve resumo do que será abordado"}]`;
  const result = await model.generateContent(prompt);
  return ensureArray(JSON.parse(extractJSON(result.response.text())));
}

async function handleGenerateMaterialContent(genAI, modelName, { material }) {
  const model = genAI.getGenerativeModel({ model: modelName, safetySettings: SAFETY_SETTINGS });
  const prompt = `Você é um Professor de Cursinho Preparatório focado em aprovação.
  Gere uma APOSTILA ou RESUMO DE ESTUDO completo e altamente organizado em Markdown para o tema: "${material.title}".
  
  ESTRUTURA OBRIGATÓRIA:
  1. Título Chamativo (H1)
  2. Introdução ao Tema (Contextualização para concursos)
  3. Tópicos Detalhados e Aprofundados (H2 e H3)
  4. Quadros Comparativos ou Tabelas (se aplicável)
  5. Dicas de Ouro / Bizus (Destaque usando blocos de citação)
  6. Resumo Final (Bullet points para revisão rápida)
  
  FOCO: O conteúdo deve ser denso, profissional e pronto para ser impresso como material de estudo de alto nível.`;
  const result = await model.generateContent(prompt);
  return { content: result.response.text() };
}

async function handleGenerateRoutine(genAI, modelName, { targetExam, hours, subjects }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName, 
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prompt = `Crie rotina de estudos JSON para ${targetExam} (${hours}h/dia). Foco: ${subjects}. Schema: {"weekSchedule":[{"day": "Segunda", "focus": "Matéria", "tasks": [{"subject": "X", "activity": "Y", "duration": "1h"}]}]}`;
  const result = await model.generateContent(prompt);
  return JSON.parse(extractJSON(result.response.text()));
}

async function handleUpdateRadar(genAI, modelName) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prompt = `Liste 5 concursos previstos. JSON Array: [{"institution":"Nome","title":"Cargo","forecast":"Previsão","status":"Previsto","salary":"R$","board":"Banca","url":""}]`;
  const result = await model.generateContent(prompt);
  return ensureArray(JSON.parse(extractJSON(result.response.text())));
}

// --- ROTAS ---

app.post('/api/gemini', async (req, res) => {
  const { action, payload } = req.body;
  
  try {
    const ai = getAI();
    const result = await runWithModelFallback(ai, action, payload);

    if (!result) {
      throw new Error("A IA não retornou dados para esta ação.");
    }

    res.json(result);

  } catch (error) {
    console.error(`[Erro API] ${action}:`, error.message);
    
    if (error.message.includes("API_KEY")) {
      return res.status(500).json({ error: "Chave API inválida ou não configurada." });
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
