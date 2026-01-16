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

// --- LISTA DE MODELOS (PRIORIDADE GEMINI 3) ---
// Atualizado para usar os modelos mais recentes solicitados.
const MODEL_FALLBACK_LIST = [
  "gemini-3-flash-preview",   // Prioridade 1: Solicitado (Mais rápido/eficiente)
  "gemini-3-pro-preview",     // Prioridade 2: Maior capacidade de raciocínio
  "gemini-2.0-flash-exp",     // Fallback: Versão experimental recente
  "gemini-2.0-flash",         // Fallback: Versão Flash 2.0
  "gemini-flash-latest"       // Fallback: Alias genérico do Google (aponta para o mais estável)
];

// Configurações de segurança permissivas
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

// --- HELPERS ---

function cleanJSON(text) {
  if (!text) return "{}";
  return text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Inicializa a IA com a chave do ambiente
function getAI() {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// --- FUNÇÃO "BLINDADA" DE EXECUÇÃO ---
async function runWithModelFallback(ai, actionCallback) {
  let lastError = null;

  // Se o usuário definiu AI_MODEL manualmente, tenta ele primeiro.
  const modelsToTry = process.env.AI_MODEL 
    ? [process.env.AI_MODEL, ...MODEL_FALLBACK_LIST] 
    : MODEL_FALLBACK_LIST;

  const uniqueModels = [...new Set(modelsToTry)];

  for (const model of uniqueModels) {
    try {
      // console.log(`Tentando modelo: ${model}...`); 
      return await actionCallback(model);
    } catch (error) {
      const errorMessage = error.message || "";
      
      // 1. Erro de Modelo não encontrado (404)
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        console.warn(`⚠️ Modelo ${model} não disponível. Tentando próximo...`);
        lastError = error;
        continue; 
      }

      // 2. Erro de Limite de Cota (429 - Resource Exhausted)
      if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        console.warn(`⚠️ Modelo ${model} ocupado (429). Aguardando 2s...`);
        await sleep(2000); 
        lastError = error;
        continue;
      }
      
      // Outros erros, lança direto
      throw error;
    }
  }

  // Se chegou aqui, falhou em todos
  console.error("❌ Todos os modelos falharam.");
  
  if (lastError && lastError.message.includes("429")) {
    throw new Error("O servidor da IA está sobrecarregado (Muitas requisições). Aguarde 30 segundos e tente novamente.");
  }
  
  throw new Error(`Não foi possível conectar aos modelos Gemini 3 ou anteriores. Detalhe: ${lastError?.message}`);
}

// --- LÓGICA DE NEGÓCIO ---

async function handleGenerateQuiz(ai, modelName, { topic, difficulty, numberOfQuestions }) {
  const prompt = `Gere um JSON array com ${numberOfQuestions} questões de concurso sobre "${topic}" (Nível: ${difficulty}).
  Formato obrigatório:
  [
    {
      "id": "uuid",
      "text": "Pergunta aqui?",
      "options": ["A", "B", "C", "D", "E"],
      "correctAnswerIndex": 0,
      "explanation": "Por que a resposta é tal..."
    }
  ]`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });
  
  return JSON.parse(cleanJSON(response.text));
}

async function handleAskTutor(ai, modelName, { history, message }) {
  // Mantém histórico curto para evitar estouro de tokens
  const limitedHistory = (history || []).slice(-5);
  
  const chat = ai.chats.create({
    model: modelName,
    history: limitedHistory,
    config: {
      systemInstruction: "Você é o BizuBot, mentor de concursos. Seja direto, motivador e use Markdown.",
      safetySettings: SAFETY_SETTINGS
    }
  });
  
  const result = await chat.sendMessage({ message });
  return { text: result.text };
}

async function handleGenerateMaterials(ai, modelName, { count }) {
  const prompt = `Sugira ${count} materiais de estudo para concursos públicos hoje.
  Retorne JSON Array:
  [
    {
      "title": "Titulo",
      "category": "Materia",
      "type": "ARTICLE", // ou PDF, VIDEO
      "duration": "10 min",
      "summary": "Resumo curto"
    }
  ]`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleGenerateMaterialContent(ai, modelName, { material }) {
  const prompt = `Crie uma aula completa (formato Markdown) sobre: ${material.title} (${material.category}).`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });

  return { content: response.text };
}

async function handleGenerateRoutine(ai, modelName, { targetExam, hours, subjects }) {
  const prompt = `Crie uma rotina semanal (JSON) para passar no concurso: ${targetExam}. 
  Disponibilidade: ${hours}h/dia. Matérias: ${subjects}.
  Formato: { "weekSchedule": [ { "day": "Segunda", "focus": "...", "tasks": [{ "subject": "...", "activity": "...", "duration": "..." }] } ] }`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleUpdateRadar(ai, modelName) {
  const prompt = `Liste 5 concursos previstos no Brasil (JSON Array).
  Campos: institution, title, forecast, status (Edital Publicado/Autorizado/Previsto), salary, board, url.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

// --- ROTAS DA API ---

app.post('/api/gemini', async (req, res) => {
  const { action, payload } = req.body;
  console.log(`[API] Recebendo ação: ${action}`);

  try {
    const ai = getAI();
    let result;

    await runWithModelFallback(ai, async (modelName) => {
        switch (action) {
            case 'generateQuiz': result = await handleGenerateQuiz(ai, modelName, payload); break;
            case 'askTutor': result = await handleAskTutor(ai, modelName, payload); break;
            case 'generateMaterials': result = await handleGenerateMaterials(ai, modelName, payload); break;
            case 'generateMaterialContent': result = await handleGenerateMaterialContent(ai, modelName, payload); break;
            case 'generateRoutine': result = await handleGenerateRoutine(ai, modelName, payload); break;
            case 'updateRadar': result = await handleUpdateRadar(ai, modelName); break;
            default: throw new Error("Ação desconhecida");
        }
    });

    res.json(result);

  } catch (error) {
    console.error(`[API] Erro Final:`, error.message);
    
    if (error.message === "API_KEY_MISSING") {
      return res.status(500).json({ error: "ERRO DE CONFIGURAÇÃO: Chave de API não encontrada." });
    }
    
    if (error.message.includes("servidor da IA está sobrecarregado")) {
      return res.status(429).json({ error: "Servidores ocupados. Aguarde alguns segundos." });
    }

    res.status(500).json({ error: error.message || "Erro interno na IA." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ SERVIDOR ONLINE NA PORTA ${PORT}`);
  console.log(`🛡️  Modelos Gemini 3 Ativados: ${MODEL_FALLBACK_LIST.join(', ')}`);
});
