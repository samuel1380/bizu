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
  "gemini-1.5-flash-8b"     // Opção ultra-leve
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

function getAI() {
  const key = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("API_KEY_MISSING");
  }
  
  // Se for OpenRouter ou tiver BASE_URL, retornamos um objeto especial para ser tratado no executor
  if (process.env.AI_BASE_URL || key.startsWith('sk-or-v1-')) {
    return {
      isOpenRouter: true,
      apiKey: key,
      baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.AI_MODEL || 'google/gemini-2.0-flash-exp:free'
    };
  }

  return new GoogleGenAI({ apiKey: key });
}

// --- CHAMADA OPENROUTER (FALLBACK) ---
async function callOpenRouter(config, prompt, isJson = false, history = null) {
  const headers = {
    "Authorization": `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://bizu.app", // Opcional para OpenRouter
    "X-Title": "Bizu App"
  };

  const messages = history ? [...history] : [];
  if (prompt) {
    messages.push({ role: "user", content: prompt });
  }

  const body = {
    model: config.model,
    messages: messages,
    response_format: isJson ? { type: "json_object" } : undefined
  };

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Erro OpenRouter: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.choices[0].message.content
  };
}

// --- EXECUTOR UNIVERSAL ---
async function runWithModelFallback(ai, actionCallback, actionName, payload) {
  // Se for OpenRouter, usamos a lógica simplificada de fetch
  if (ai.isOpenRouter) {
    console.log(`[OpenRouter] Executando ${actionName} com ${ai.model}`);
    
    // Mapeamento de ações para OpenRouter
    if (actionName === 'generateQuiz') {
      const prompt = `Gere ${payload.numberOfQuestions} questões sobre "${payload.topic}" (${payload.difficulty}). Responda APENAS JSON. Schema: [{id, text, options:[], correctAnswerIndex:number, explanation}]`;
      const res = await callOpenRouter(ai, prompt, true);
      return JSON.parse(extractJSON(res.text));
    }
    
    if (actionName === 'askTutor') {
      const history = (payload.history || []).map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.parts[0].text
      }));
      return await callOpenRouter(ai, payload.message, false, history);
    }

    if (actionName === 'generateMaterials') {
      const prompt = `Liste ${payload.count} materiais de estudo sobre concursos. JSON Array: [{title, category, type:"PDF", duration, summary}]`;
      const res = await callOpenRouter(ai, prompt, true);
      return JSON.parse(extractJSON(res.text));
    }

    if (actionName === 'generateMaterialContent') {
      const prompt = `Gere conteúdo Markdown para: ${payload.material.title}`;
      const res = await callOpenRouter(ai, prompt, false);
      return { content: res.text };
    }

    if (actionName === 'generateRoutine') {
      const prompt = `Crie rotina de estudos JSON para ${payload.targetExam} (${payload.hours}h/dia). Foco: ${payload.subjects}. Schema: {weekSchedule:[{day, focus, tasks:[{subject, activity, duration}]}]}`;
      const res = await callOpenRouter(ai, prompt, true);
      return JSON.parse(extractJSON(res.text));
    }

    if (actionName === 'updateRadar') {
      const prompt = `Liste 5 concursos previstos. JSON Array: [{institution, title, forecast, status, salary, board, url}]`;
      const res = await callOpenRouter(ai, prompt, true);
      return JSON.parse(extractJSON(res.text));
    }

    throw new Error(`Ação ${actionName} não implementada para OpenRouter`);
  }

  // Lógica original para Google SDK
  let modelsToTry = [...MODEL_FALLBACK_LIST];
  
  if (process.env.AI_MODEL) {
    console.log(`[Config] Modelo forçado pelo usuário: ${process.env.AI_MODEL}`);
    // Coloca o modelo do usuário no topo da lista
    modelsToTry = [process.env.AI_MODEL, ...modelsToTry.filter(m => m !== process.env.AI_MODEL)];
  }

  // Remove duplicatas
  const uniqueModels = [...new Set(modelsToTry)];

  for (const model of uniqueModels) {
    try {
      // console.log(`Tentando modelo: ${model}...`);
      return await actionCallback(model);
    } catch (error) {
      const msg = error.message || "";
      
      // Se for erro de cota (429), esperamos um pouco e tentamos o próximo
      if (msg.includes("429") || msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED")) {
        console.warn(`⚠️ ${model} atingiu o limite (429). Alternando...`);
        await sleep(1000); // Backoff curto para trocar de modelo rápido
        continue;
      }

      // Se o modelo não existir (404), vai para o próximo
      if (msg.includes("404") || msg.includes("not found")) {
        console.warn(`⚠️ ${model} não disponível para sua chave API. Alternando...`);
        continue;
      }

      // Se for outro erro, lançamos para ser tratado na rota
      throw error;
    }
  }

  throw new Error("Todos os modelos de IA falharam ou estão ocupados.");
}

// --- AÇÕES ---

async function handleGenerateQuiz(ai, modelName, { topic, difficulty, numberOfQuestions }) {
  // Configuração para garantir JSON mesmo em modelos antigos
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
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { 
      responseMimeType: "application/json", 
      safetySettings: SAFETY_SETTINGS 
    }
  });
  
  const jsonStr = extractJSON(response.text);
  return JSON.parse(jsonStr);
}

async function handleAskTutor(ai, modelName, { history, message }) {
  // Limita contexto para economizar tokens e evitar erros em modelos com janela pequena
  const limitedHistory = (history || []).slice(-6); 
  
  const chat = ai.chats.create({
    model: modelName,
    history: limitedHistory,
    config: {
      systemInstruction: "Você é o BizuBot, um mentor de concursos. Responda de forma direta, motivadora e use Markdown (negrito, listas).",
      safetySettings: SAFETY_SETTINGS
    }
  });
  
  const result = await chat.sendMessage({ message });
  
  // Tratamento para respostas vazias
  if (!result.text || result.text.trim() === "") {
     return { text: "⚠️ A IA recebeu sua mensagem mas não gerou texto. Tente reformular." };
  }
  
  return { text: result.text };
}

async function handleGenerateMaterials(ai, modelName, { count }) {
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

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(extractJSON(response.text));
}

async function handleGenerateMaterialContent(ai, modelName, { material }) {
  // Sem JSON mode aqui, queremos Markdown texto livre
  const prompt = `Gere o conteúdo completo de uma apostila/artigo sobre: "${material.title}".
  Use Markdown.
  Estrutura:
  - Introdução
  - Tópicos Principais (Detalhados)
  - Exemplos
  - Conclusão`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });

  return { content: response.text };
}

async function handleGenerateRoutine(ai, modelName, { targetExam, hours, subjects }) {
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

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(extractJSON(response.text));
}

async function handleUpdateRadar(ai, modelName) {
  const prompt = `Liste 5 concursos públicos brasileiros em destaque recentemente.
  JSON Array.
  Schema:
  [{"institution":"Nome","title":"Cargo","forecast":"Previsão","status":"Previsto","salary":"R$","board":"Banca","url":""}]`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(extractJSON(response.text));
}

// --- ROTAS ---

app.post('/api/gemini', async (req, res) => {
  const { action, payload } = req.body;
  
  try {
    const ai = getAI();
    let result;

    await runWithModelFallback(ai, async (modelName) => {
        // console.log(`[Executando] ${action} com ${modelName}`);
        switch (action) {
            case 'generateQuiz': result = await handleGenerateQuiz(ai, modelName, payload); break;
            case 'askTutor': result = await handleAskTutor(ai, modelName, payload); break;
            case 'generateMaterials': result = await handleGenerateMaterials(ai, modelName, payload); break;
            case 'generateMaterialContent': result = await handleGenerateMaterialContent(ai, modelName, payload); break;
            case 'generateRoutine': result = await handleGenerateRoutine(ai, modelName, payload); break;
            case 'updateRadar': result = await handleUpdateRadar(ai, modelName); break;
            default: throw new Error("Ação inválida");
        }
    }, action, payload);

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
