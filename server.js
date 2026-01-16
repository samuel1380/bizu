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

// --- LISTA DE MODELOS (PRIORIDADE GEMINI 3 FLASH PARA VELOCIDADE) ---
const MODEL_FALLBACK_LIST = [
  "gemini-3-flash-preview",   // Mais rápido e eficiente
  "gemini-3-pro-preview",     // Backup inteligente
  "gemini-2.0-flash",         // Backup estável
  "gemini-1.5-flash"          // Legado rápido
];

// Configurações de segurança permissivas para evitar bloqueios falsos
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
  // Remove blocos de código e espaços extras para garantir parseamento rápido
  return text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getAI() {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// --- FUNÇÃO "BLINDADA" DE EXECUÇÃO ---
async function runWithModelFallback(ai, actionCallback) {
  let lastError = null;

  const modelsToTry = process.env.AI_MODEL 
    ? [process.env.AI_MODEL, ...MODEL_FALLBACK_LIST] 
    : MODEL_FALLBACK_LIST;

  const uniqueModels = [...new Set(modelsToTry)];

  for (const model of uniqueModels) {
    try {
      return await actionCallback(model);
    } catch (error) {
      const errorMessage = error.message || "";
      
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        console.warn(`⚠️ Modelo ${model} off. Next...`);
        lastError = error;
        continue; 
      }

      if (errorMessage.includes("429") || errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        console.warn(`⚠️ Modelo ${model} ocupado (429). Aguardando 1s...`);
        await sleep(1000); // Delay menor para tentar manter agilidade
        lastError = error;
        continue;
      }
      
      throw error;
    }
  }

  console.error("❌ Todos os modelos falharam.");
  throw new Error("Serviço de IA instável no momento. Tente novamente em instantes.");
}

// --- LÓGICA DE NEGÓCIO OTIMIZADA ---

async function handleGenerateQuiz(ai, modelName, { topic, difficulty, numberOfQuestions }) {
  // Prompt encurtado para resposta rápida
  const prompt = `Gere JSON com ${numberOfQuestions} questões de concurso: "${topic}" (${difficulty}).
  Schema: [{"id":"uuid","text":"P","options":["A","B","C","D","E"],"correctAnswerIndex":0,"explanation":"E"}]`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });
  
  return JSON.parse(cleanJSON(response.text));
}

async function handleAskTutor(ai, modelName, { history, message }) {
  const limitedHistory = (history || []).slice(-4); // Histórico menor = menos tokens = mais rápido
  
  const chat = ai.chats.create({
    model: modelName,
    history: limitedHistory,
    config: {
      systemInstruction: "Seja o BizuBot. Respostas curtas, diretas e motivadoras. Use Markdown.",
      safetySettings: SAFETY_SETTINGS
    }
  });
  
  const result = await chat.sendMessage({ message });
  return { text: result.text };
}

async function handleGenerateMaterials(ai, modelName, { count }) {
  // PROMPT ALTERADO: Apenas PDF e ARTICLE. Proibido VIDEO.
  const prompt = `Liste ${count} materiais de estudo técnicos sobre concursos.
  TIPOS PERMITIDOS: "PDF" (Apostilas/Guias) ou "ARTICLE" (Resumos Teóricos).
  NÃO GERE VÍDEOS.
  Schema: [{"title":"T","category":"C","type":"PDF","duration":"15 pág","summary":"S"}]`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleGenerateMaterialContent(ai, modelName, { material }) {
  // PROMPT ALTERADO: Gera estrutura de documento PDF
  const prompt = `Escreva uma APOSTILA COMPLETA E DETALHADA sobre: ${material.title}.
  Formato: Markdown bem estruturado.
  Estrutura obrigatória:
  1. Título e Introdução
  2. Conceitos Chave (Use tópicos e negrito)
  3. Aprofundamento Teórico (Texto denso e explicativo)
  4. Exemplos Práticos ou Jurisprudência
  5. Conclusão/Resumo
  
  O tom deve ser formal e educativo, pronto para ser impresso como PDF.`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });

  return { content: response.text };
}

async function handleGenerateRoutine(ai, modelName, { targetExam, hours, subjects }) {
  // Prompt simplificado para evitar erro de JSON aninhado complexo
  const prompt = `Crie cronograma para ${targetExam} (${hours}h/dia). Foco: ${subjects}.
  Retorne JSON estrito:
  { "weekSchedule": [ 
    { "day": "Segunda", "focus": "Foco do dia", "tasks": [{ "subject": "Matéria", "activity": "Teoria/Questões", "duration": "tempo" }] } 
  ] }`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleUpdateRadar(ai, modelName) {
  const prompt = `5 concursos públicos BRASIL previstos/abertos recentes.
  Schema: [{"institution":"I","title":"Cargo","forecast":"Data","status":"Edital Publicado","salary":"R$","board":"Banca","url":""}]`;

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
  console.log(`[API] Ação rápida: ${action}`);

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
    console.error(`[API] Erro:`, error.message);
    
    if (error.message === "API_KEY_MISSING") {
      return res.status(500).json({ error: "Configuração de API inválida." });
    }
    
    res.status(500).json({ error: "Instabilidade momentânea na IA. Tente novamente." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor Otimizado (Gemini 3 Flash) na porta ${PORT}`);
});
