import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Vercel Serverless Function
export default async function handler(req, res) {
  // CORS handling for safety
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
    return res.status(500).json({ error: 'Server misconfigured: Missing API Key' });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // MUDANÇA: Usando Gemini 2.0 Flash
  // É o modelo mais rápido e estável atualmente para alto volume de requisições (muitos clientes)
  const modelName = "gemini-2.0-flash"; 
  
  const { action, payload } = req.body;

  try {
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
        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("AI Error:", error);
    if (error.message && error.message.includes('429')) {
        return res.status(429).json({ error: 'Muitas pessoas usando o Bizu agora! O sistema tentará novamente...' });
    }
    return res.status(500).json({ error: 'Erro ao processar solicitação', details: error.message });
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
  Dificuldade: ${config.difficulty}.
  Foco: Letra da lei e jurisprudência.
  Seja direto.`;
  
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
      // thinkingConfig REMOVIDO: Não suportado no 2.0 Flash e causa lentidão/erros
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING, description: "Enunciado curto" },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "4 alternativas" 
            },
            correctAnswerIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING, description: "Breve justificativa" }
          },
          required: ["id", "text", "options", "correctAnswerIndex", "explanation"]
        }
      }
    }
  });

  return JSON.parse(response.text);
}

async function handleAskTutor(ai, model, { history, message }) {
  const chat = ai.chats.create({
    model,
    history: history,
    config: {
      safetySettings: SAFETY_SETTINGS,
      // systemInstruction simplificado para evitar sobrecarga de tokens no setup
      systemInstruction: "Você é o 'BizuBot'. Responda de forma curta, direta e motivadora. Use gírias de concurso.",
    }
  });

  const response = await chat.sendMessage({ message });
  return { text: response.text };
}

async function handleGenerateMaterials(ai, model, { count }) {
  const topics = ["Direito Constitucional", "Administrativo", "Penal", "Raciocínio Lógico", "Informática"];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];

  const prompt = `Sugira ${count} materiais de estudo sobre: ${randomTopic}. PT-BR.`;

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

  return JSON.parse(response.text);
}

async function handleMaterialContent(ai, model, { material }) {
  const prompt = `Crie conteúdo didático para: ${material.title} (${material.category}).
  Seja objetivo, use tópicos e cite leis importantes.`;

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
  const prompt = `Crie um ciclo de estudos semanal para: "${targetExam}", ${hours}h/dia. Matérias: ${subjects}.`;

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

  return JSON.parse(response.text);
}

async function handleUpdateRadar(ai, model) {
  const today = new Date().toLocaleDateString('pt-BR');
  const prompt = `Pesquise "Concursos 2026 Brasil". Liste 6 oportunidades REAIS e seus links de origem (url). Data: ${today}.`;

  const response = await ai.models.generateContent({
    model, 
    contents: prompt,
    config: {
      // Gemini 2.0 Flash suporta tools, mas em ambientes serverless como Vercel
      // o tempo de execução do Google Search pode causar timeout.
      // Mantivemos ativado, mas se continuar dando erro, remova a linha 'tools'.
      tools: [{ googleSearch: {} }],
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

  let jsonString = response.text;
  if (jsonString.includes('```')) {
    jsonString = jsonString.replace(/^```json\s?/, '').replace(/^```\s?/, '').replace(/```$/, '');
  }
  
  return JSON.parse(jsonString);
}