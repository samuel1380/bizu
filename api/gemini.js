import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Helper para limpar JSON vindo da IA (remove markdown ```json ... ```)
function cleanJSON(text) {
  if (!text) return "{}";
  let cleaned = text.trim();
  // Remove blocos de código markdown
  cleaned = cleaned.replace(/^```json\s?/, '').replace(/^```\s?/, '').replace(/```$/, '');
  return cleaned;
}

export default async function handler(req, res) {
  // Configuração de CORS para permitir chamadas do frontend
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.API_KEY) {
    console.error("API Key is missing in environment variables.");
    return res.status(500).json({ error: 'Server misconfigured: Missing API Key' });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Usando Gemini 2.0 Flash para máxima velocidade (evita timeout de 10s do Vercel)
  const modelName = "gemini-2.0-flash"; 
  
  const { action, payload } = req.body;

  try {
    let result;
    // Timeout de segurança interno para evitar que a função fique pendurada
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout interno da função")), 9500)
    );

    const actionPromise = (async () => {
        switch (action) {
          case 'generateQuiz':
            return await handleGenerateQuiz(ai, modelName, payload);
          case 'askTutor':
            return await handleAskTutor(ai, modelName, payload);
          case 'generateMaterials':
            return await handleGenerateMaterials(ai, modelName, payload);
          case 'generateMaterialContent':
            return await handleMaterialContent(ai, modelName, payload);
          case 'generateRoutine':
            return await handleGenerateRoutine(ai, modelName, payload);
          case 'updateRadar':
            return await handleUpdateRadar(ai, modelName);
          default:
            throw new Error('Invalid action');
        }
    })();

    // Race entre a execução da IA e o timeout de 9.5s
    result = await Promise.race([actionPromise, timeoutPromise]);

    return res.status(200).json(result);

  } catch (error) {
    console.error(`AI Error [${action}]:`, error);
    
    // Tratamento específico para Rate Limit (Cota excedida)
    if (error.message && (error.message.includes('429') || error.message.includes('Resource has been exhausted'))) {
        return res.status(429).json({ 
            error: 'O sistema está sobrecarregado (Muitas requisições). Aguarde 1 minuto e tente novamente.' 
        });
    }

    // Tratamento para JSON inválido ou outros erros de parsing
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return res.status(500).json({ error: 'Erro ao processar resposta da IA (Formato inválido).' });
    }

    return res.status(500).json({ error: 'Erro interno ao processar solicitação.', details: error.message });
  }
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

async function handleGenerateQuiz(ai, model, config) {
  const prompt = `Gere ${config.numberOfQuestions} perguntas de múltipla escolha sobre: "${config.topic}".
  Nível: ${config.difficulty}.
  Retorne APENAS o JSON puro, sem markdown.`;
  
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
  // Limita o histórico para economizar tokens e evitar erro 400 se for muito grande
  const limitedHistory = history.slice(-10); 
  
  const chat = ai.chats.create({
    model,
    history: limitedHistory,
    config: {
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: "Você é o BizuBot, um tutor para concursos públicos. Seja motivador, direto e use gírias leves de concurseiro (ex: 'faca na caveira', 'bizu', 'papiro').",
    }
  });

  const response = await chat.sendMessage({ message });
  return { text: response.text };
}

async function handleGenerateMaterials(ai, model, { count }) {
  const prompt = `Sugira ${count} tópicos de estudo aleatórios para concursos (Direito, Lógica, Português, TI). Retorne JSON puro.`;

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
  const prompt = `Escreva uma aula completa e didática sobre: ${material.title} (${material.category}). Use formatação Markdown, negrito em palavras chave, listas e exemplos práticos.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
    }
  });

  return { content: response.text };
}

async function handleGenerateRoutine(ai, model, { targetExam, hours, subjects }) {
  const prompt = `Crie um cronograma semanal para o concurso: "${targetExam}", estudando ${hours}h por dia. Foco em: ${subjects}. Retorne JSON puro.`;

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
  // REMOVIDO: tools: [{ googleSearch: {} }] 
  // O Google Search tool frequentemente causa timeout (>10s) em Serverless Functions gratuitas.
  // A estratégia agora é usar o conhecimento interno do modelo para estimar com base no padrão.
  
  const prompt = `Liste 5 concursos públicos grandes previstos ou abertos no Brasil para 2025/2026. 
  Preencha com dados realistas baseados no seu conhecimento sobre ciclos de concursos (PF, PRF, INSS, Tribunais, Bancos).
  Retorne JSON puro.`;

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