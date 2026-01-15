import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Configuração CRUCIAL para Vercel: Edge Runtime
// Isso permite que a função rode por mais tempo e inicie instantaneamente,
// evitando os erros 500/504 comuns no plano gratuito.
export const config = {
  runtime: 'edge',
};

// Helper para limpar JSON vindo da IA
function cleanJSON(text) {
  if (!text) return "{}";
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s?/, '').replace(/^```\s?/, '').replace(/```$/, '');
  return cleaned;
}

export default async function handler(req) {
  // CORS Headers para Edge Function
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
    'Content-Type': 'application/json'
  };

  // Tratamento de Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  try {
    // No Edge Runtime, pegamos o body assim:
    const body = await req.json();
    const { action, payload } = body;

    if (!process.env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: Missing API Key' }), { status: 500, headers });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Gemini 2.0 Flash é o mais rápido e estável para Edge Functions
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
    console.error("AI Error:", error);
    
    // Tratamento de Cota (429)
    if (error.message && (error.message.includes('429') || error.message.includes('exhausted'))) {
        return new Response(JSON.stringify({ 
            error: 'Muitas requisições ao mesmo tempo. O sistema está sobrecarregado, aguarde alguns segundos.' 
        }), { status: 429, headers });
    }

    return new Response(JSON.stringify({ 
        error: 'Erro interno na IA.', 
        details: error.message 
    }), { status: 500, headers });
  }
}

// Configurações de Segurança
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- Funções Auxiliares (Mesma lógica, adaptada para garantir rapidez) ---

async function handleGenerateQuiz(ai, model, config) {
  const prompt = `Gere ${config.numberOfQuestions} perguntas de múltipla escolha sobre: "${config.topic}". Nível: ${config.difficulty}. Retorne APENAS JSON puro.`;
  
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswerIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING }
          },
          required: ["id", "text", "options", "correctAnswerIndex", "explanation"]
        }
      }
    }
  });
  return JSON.parse(cleanJSON(response.text));
}

async function handleAskTutor(ai, model, { history, message }) {
  const limitedHistory = history.slice(-6); // Reduzido para economizar payload no Edge
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
  const prompt = `Sugira ${count} materiais de estudo para concursos públicos (variados). Retorne JSON puro.`;
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["PDF", "VIDEO", "ARTICLE"] },
            duration: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ["title", "category", "type", "duration", "summary"]
        }
      }
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
  const prompt = `Cronograma semanal para "${targetExam}", ${hours}h/dia, matérias: ${subjects}. Retorne JSON puro.`;
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          weekSchedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                focus: { type: Type.STRING },
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      subject: { type: Type.STRING },
                      activity: { type: Type.STRING },
                      duration: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(cleanJSON(response.text));
}

async function handleUpdateRadar(ai, model) {
  const prompt = `Liste 5 grandes concursos 2025/2026 no Brasil. Dados realistas. Retorne JSON puro.`;
  const response = await ai.models.generateContent({
    model, 
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            institution: { type: Type.STRING },
            title: { type: Type.STRING },
            forecast: { type: Type.STRING },
            status: { type: Type.STRING, enum: ['Edital Publicado', 'Banca Definida', 'Autorizado', 'Solicitado', 'Previsto'] },
            salary: { type: Type.STRING },
            board: { type: Type.STRING },
            url: { type: Type.STRING }
          },
          required: ["institution", "title", "forecast", "status", "salary", "board"]
        }
      }
    }
  });
  return JSON.parse(cleanJSON(response.text));
}
