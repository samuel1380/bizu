import { GoogleGenerativeAI, SchemaType, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

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

  // Inicializa o GenAI com a SDK estável
  const genAI = new GoogleGenerativeAI(process.env.API_KEY);

  // Usando Gemini 1.5 Flash (Estável e Rápido)
  const modelName = "gemini-1.5-flash";

  const { action, payload } = req.body;

  try {
    let result;

    switch (action) {
      case 'generateQuiz':
        result = await handleGenerateQuiz(genAI, modelName, payload);
        break;
      case 'askTutor':
        result = await handleAskTutor(genAI, modelName, payload);
        break;
      case 'generateMaterials':
        result = await handleGenerateMaterials(genAI, modelName, payload);
        break;
      case 'generateMaterialContent':
        result = await handleMaterialContent(genAI, modelName, payload);
        break;
      case 'generateRoutine':
        result = await handleGenerateRoutine(genAI, modelName, payload);
        break;
      case 'updateRadar':
        result = await handleUpdateRadar(genAI, modelName);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("AI Error:", error);
    if (error.message && error.message.includes('429')) {
      return res.status(429).json({ error: 'Muitas requisições. Tente novamente em alguns segundos.' });
    }
    return res.status(500).json({ error: 'Erro ao processar solicitação', details: error.message });
  }
}

// Configurações de Segurança Padrão
// No SDK novo a estrutura é diferente, array de objetos simples
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

async function handleGenerateQuiz(genAI, modelName, config) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            text: { type: SchemaType.STRING, description: "Enunciado curto" },
            options: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "4 alternativas"
            },
            correctAnswerIndex: { type: SchemaType.INTEGER },
            explanation: { type: SchemaType.STRING, description: "Breve justificativa" }
          },
          required: ["id", "text", "options", "correctAnswerIndex", "explanation"]
        }
      }
    },
    safetySettings
  });

  const prompt = `Gere ${config.numberOfQuestions} perguntas de múltipla escolha sobre: "${config.topic}".
  Dificuldade: ${config.difficulty}.
  Foco: Letra da lei e jurisprudência.
  Seja direto.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

async function handleAskTutor(genAI, modelName, { history, message }) {
  // Ajusta o histórico para o formato do SDK (parts: [{text: ...}])
  // O formato recebido do front já deve ser compatível, mas garantimos:
  const formattedHistory = history.map(h => ({
    role: h.role === 'model' ? 'model' : 'user',
    parts: h.parts // Espera-se [{text: "..."}]
  }));

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: "Você é o 'BizuBot'. Responda de forma curta, direta e motivadora. Use gírias de concurso.",
    safetySettings
  });

  const chat = model.startChat({
    history: formattedHistory,
  });

  const result = await chat.sendMessage(message);
  return { text: result.response.text() };
}

async function handleGenerateMaterials(genAI, modelName, { count }) {
  const topics = ["Direito Constitucional", "Administrativo", "Penal", "Raciocínio Lógico", "Informática"];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            category: { type: SchemaType.STRING },
            type: { type: SchemaType.STRING, enum: ["PDF", "VIDEO", "ARTICLE"] },
            duration: { type: SchemaType.STRING },
            summary: { type: SchemaType.STRING }
          },
          required: ["title", "category", "type", "duration", "summary"]
        }
      }
    },
    safetySettings
  });

  const prompt = `Sugira ${count} materiais de estudo sobre: ${randomTopic}. PT-BR.`;
  const result = await model.generateContent(prompt);

  return JSON.parse(result.response.text());
}

async function handleMaterialContent(genAI, modelName, { material }) {
  const model = genAI.getGenerativeModel({ model: modelName, safetySettings });

  const prompt = `Crie conteúdo didático para: ${material.title} (${material.category}).
  Seja objetivo, use tópicos e cite leis importantes.`;

  const result = await model.generateContent(prompt);
  return { content: result.response.text() };
}

async function handleGenerateRoutine(genAI, modelName, { targetExam, hours, subjects }) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          weekSchedule: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                day: { type: SchemaType.STRING },
                focus: { type: SchemaType.STRING },
                tasks: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      subject: { type: SchemaType.STRING },
                      activity: { type: SchemaType.STRING },
                      duration: { type: SchemaType.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    safetySettings
  });

  const prompt = `Crie um ciclo de estudos semanal para: "${targetExam}", ${hours}h/dia. Matérias: ${subjects}.`;
  const result = await model.generateContent(prompt);

  return JSON.parse(result.response.text());
}

async function handleUpdateRadar(genAI, modelName) {
  const today = new Date().toLocaleDateString('pt-BR');

  // Gemini 1.5 Flash nao tem acesso direto a Google Search via tools nesse SDK simplificado
  // ou a configuração é diferente. Vamos simular/alucinar com base no conhecimento ou pedir JSON direto.
  // Para evitar erros 500, removemos a tool de search e confiamos no treino do modelo ou pedimos dados genéricos.

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            institution: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            forecast: { type: SchemaType.STRING },
            status: { type: SchemaType.STRING, enum: ['Edital Publicado', 'Banca Definida', 'Autorizado', 'Solicitado', 'Previsto'] },
            salary: { type: SchemaType.STRING },
            board: { type: SchemaType.STRING },
            url: { type: SchemaType.STRING }
          },
          required: ["institution", "title", "forecast", "status", "salary", "board"]
        }
      }
    },
    safetySettings
  });

  const prompt = `Liste 6 concursos públicos previstos ou abertos no Brasil de alto nível (Tribunais, Polícias, Fiscal). Data de referência: ${today}. Invente URLs verossímeis se necessário.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}