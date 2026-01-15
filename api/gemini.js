import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Configuração para Vercel Edge Runtime
export const config = {
  runtime: 'edge',
};

// Helper para limpar JSON vindo da IA
function cleanJSON(text) {
  if (!text) return "{}";
  let cleaned = text.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```json\s?/, '').replace(/^```\s?/, '').replace(/```$/, '');
  return cleaned;
}

export default async function handler(req) {
  // Configuração de CORS para Edge
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    // Log para debug no servidor (Render/Vercel Logs)
    console.log(`[API] Processing action: ${action}`);

    if (!process.env.API_KEY) {
      console.error("[API] Erro: API_KEY não definida.");
      return new Response(JSON.stringify({ error: 'Server misconfigured: Missing API Key' }), { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Modelo rápido e estável
    const modelName = "gemini-2.0-flash"; 

    let result;

    switch (action) {
      case 'generateQuiz':
        result = await handleGenerateQuiz(ai, modelName, payload);
        break;
      case 'askTutor':
        result = await handleAskTutor(ai, modelName, payload);
        break;
      case 'generateMaterials':
        result = await handleGenerateMaterials(ai, modelName, payload);
        break;
      case 'generateMaterialContent':
        result = await handleMaterialContent(ai, modelName, payload);
        break;
      case 'generateRoutine':
        result = await handleGenerateRoutine(ai, modelName, payload);
        break;
      case 'updateRadar':
        result = await handleUpdateRadar(ai, modelName);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers });
    }

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (error) {
    console.error("[API] Error:", error);
    
    // Tratamento específico de erro
    let status = 500;
    let message = 'Erro interno na IA.';
    
    if (error.message && (error.message.includes('429') || error.message.includes('exhausted'))) {
        status = 429;
        message = 'Muitas requisições. Aguarde um momento.';
    } else if (error instanceof SyntaxError) {
        message = 'A IA retornou um formato inválido. Tente novamente.';
    }

    return new Response(JSON.stringify({ 
        error: message, 
        details: error.message 
    }), { status, headers });
  }
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- Handlers ---

async function handleGenerateQuiz(ai, model, config) {
  const prompt = `Gere ${config.numberOfQuestions} perguntas de múltipla escolha sobre: "${config.topic}". Nível: ${config.difficulty}. Retorne APENAS um array JSON.`;
  
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(cleanJSON(response.text));
}

async function handleAskTutor(ai, model, { history, message }) {
  const limitedHistory = history.slice(-6);
  const chat = ai.chats.create({
    model,
    history: limitedHistory,
    config: {
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: "Você é o BizuBot. Responda de forma curta, motivadora e direta.",
    }
  });
  const response = await chat.sendMessage({ message });
  return { text: response.text };
}

async function handleGenerateMaterials(ai, model, { count }) {
  const prompt = `Sugira ${count} materiais de estudo para concursos públicos (variados). Retorne APENAS um array JSON.`;
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(cleanJSON(response.text));
}

async function handleMaterialContent(ai, model, { material }) {
  const prompt = `Crie uma aula didática (Markdown) sobre: ${material.title}. Seja breve e use tópicos.`;
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });
  return { content: response.text };
}

async function handleGenerateRoutine(ai, model, { targetExam, hours, subjects }) {
  const prompt = `Cronograma semanal para "${targetExam}", ${hours}h/dia, matérias: ${subjects}. Retorne APENAS JSON.`;
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(cleanJSON(response.text));
}

async function handleUpdateRadar(ai, model) {
  const prompt = `Liste 5 grandes concursos previstos/abertos no Brasil para 2025/2026. Dados realistas. Retorne APENAS um array JSON.`;
  const response = await ai.models.generateContent({
    model, 
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });
  return JSON.parse(cleanJSON(response.text));
}