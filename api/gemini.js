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

  // Fix: Check process.env.API_KEY directly
  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: Missing API Key' });
  }

  // Fix: Initialize with direct environment variable
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Fix: Update model to gemini-3-flash-preview
  const modelName = "gemini-3-flash-preview"; 
  
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
        return res.status(429).json({ error: 'Muitas pessoas usando o Bizu agora! Tente em 30 segundos.' });
    }
    return res.status(500).json({ error: 'Erro ao processar solicitação', details: error.message });
  }
}

// Configuração de Segurança para permitir conteúdo de Direito Penal/Criminologia
// Sem isso, a IA bloqueia perguntas sobre "Homicídio", "Drogas", etc.
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

async function handleGenerateQuiz(ai, model, config) {
  const prompt = `Você é uma banca examinadora de concursos (estilo CEBRASPE/FGV).
  Gere ${config.numberOfQuestions} perguntas de múltipla escolha EXTREMAMENTE TÉCNICAS sobre: "${config.topic}".
  Dificuldade: ${config.difficulty}.
  Idioma: Português do Brasil.
  
  IMPORTANTE:
  - Foque na letra da lei e jurisprudência.
  - As questões devem ser desafiadoras.
  - A explicação deve citar o artigo da lei ou súmula quando aplicável.`;
  
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
            text: { type: Type.STRING, description: "Enunciado da questão" },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "4 alternativas de resposta" 
            },
            correctAnswerIndex: { type: Type.INTEGER, description: "Índice (0-3) da correta" },
            explanation: { type: Type.STRING, description: "Gabarito comentado com base legal" }
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
      systemInstruction: "Você é o 'BizuBot', o melhor professor de cursinho do Brasil. Você é 'facul na caveira', direto, motivador e especialista em todas as bancas (FGV, Cebraspe, Vunesp). Use gírias de concurseiro ('lei seca', 'vade mecum', 'papiro'). Se o aluno estiver desmotivado, dê um choque de realidade. Responda sempre com formatação Markdown bonita.",
    }
  });

  const response = await chat.sendMessage({ message });
  return { text: response.text };
}

async function handleGenerateMaterials(ai, model, { count }) {
  const topics = [
    "Direito Constitucional", "Direito Administrativo", "Processo Penal", 
    "Raciocínio Lógico", "Informática para Concursos", "Legislação Especial", "Direito Penal", "AFO"
  ];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];

  const prompt = `Gere ${count} materiais de estudo focados em ALTA PERFORMANCE para concursos.
  Sugira materiais sobre: ${randomTopic} ou temas quentes do momento.
  Conteúdo em PT-BR.`;

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
            title: { type: Type.STRING, description: "Título chamativo do material" },
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
  const prompt = `Aja como um professor de elite de cursinho preparatório.
  Crie o CONTEÚDO COMPLETO para:
  Título: ${material.title}
  Área: ${material.category}
  Tipo: ${material.type}

  O conteúdo deve ser denso, rico em detalhes, citar leis, dar macetes mnemônicos e focar no que cai na prova.
  Se for VIDEO, escreva o roteiro aula passo-a-passo.
  Se for PDF, escreva o texto corrido formatado.
  
  Termine com 3 questões 'Certo ou Errado' estilo Cebraspe sobre o tema.`;

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
  const prompt = `Sou um 'concurseiro' focado em: "${targetExam}".
    Tenho ${hours} horas líquidas por dia.
    Matérias chave: ${subjects}.
    
    Monte um CICLO DE ESTUDOS semanal insano de produtivo.
    Intercale matérias teóricas com questões.
    Domingo é dia de simulado e revisão.`;

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
  const prompt = `Use a pesquisa do Google para encontrar as últimas notícias (data de hoje: ${today}) sobre Concursos Públicos no Brasil previstos para o restante de 2025 e para o ano de 2026.
  
  Foque em concursos de grande porte e carreiras top: Polícia Federal (PF), PRF, Tribunais (TSE, TRFs, TJs), Bancos, Receita Federal, INSS.
  
  Extraia informações REAIS e ATUALIZADAS. Não invente datas. Se não tiver data exata, coloque a previsão baseada nas notícias (ex: "Solicitado", "Estudos em andamento").
  Retorne exatamente 6 oportunidades mais quentes.`;

  const response = await ai.models.generateContent({
    model, // Use gemini-3-flash-preview
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }], // Use Google Search for grounding
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            institution: { type: Type.STRING, description: "Nome do Órgão (ex: Polícia Federal)" },
            title: { type: Type.STRING, description: "Cargos (ex: Agente e Escrivão)" },
            forecast: { type: Type.STRING, description: "Previsão realista da data ou status temporal (ex: 2º Sem/2026)" },
            status: { 
               type: Type.STRING, 
               enum: ['Edital Publicado', 'Banca Definida', 'Autorizado', 'Solicitado', 'Previsto'],
               description: "Status atual do certame"
            },
            salary: { type: Type.STRING, description: "Remuneração inicial (ex: R$ 14.000+)" },
            board: { type: Type.STRING, description: "Banca organizadora (ex: Cebraspe, FGV ou 'A definir')" },
            url: { type: Type.STRING, description: "URL da fonte da notícia, se disponível" }
          },
          required: ["institution", "title", "forecast", "status", "salary", "board"]
        }
      }
    }
  });

  // Nota: O URL extraído do groundingChunks poderia ser mapeado aqui, 
  // mas o modelo gemini-3-flash com responseSchema muitas vezes já infere o link se solicitado no schema ou usa seu conhecimento.
  // Para simplificar no schema JSON direto, confiamos na extração do modelo.

  return JSON.parse(response.text);
}