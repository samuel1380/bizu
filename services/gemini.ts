import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { QuizConfig, Question, StudyMaterial, StudyRoutine } from '../types';

// Obtém a chave de API injetada pelo Vite
const API_KEY = process.env.API_KEY;
const MODEL_NAME = "gemini-3-flash-preview";

// Configurações de segurança para permitir temas sensíveis (Direito Penal, Criminologia)
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Inicialização Lazy (Preguiçosa) para evitar erros se a chave não estiver presente no load inicial
const getAI = () => {
  if (!API_KEY) {
    console.error("ERRO: API Key não encontrada.");
    throw new Error("Chave de API do Google não configurada. Adicione 'API_KEY' nas variáveis de ambiente do Vercel ou no arquivo .env");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

export const hasApiKey = (): boolean => !!API_KEY;

export const generateQuizQuestions = async (config: QuizConfig): Promise<Question[]> => {
  const ai = getAI();
  
  const prompt = `Você é uma banca examinadora de concursos (estilo CEBRASPE/FGV).
  Gere ${config.numberOfQuestions} perguntas de múltipla escolha EXTREMAMENTE TÉCNICAS sobre: "${config.topic}".
  Dificuldade: ${config.difficulty}.
  Idioma: Português do Brasil.
  
  IMPORTANTE:
  - Foque na letra da lei e jurisprudência.
  - As questões devem ser desafiadoras.
  - A explicação deve citar o artigo da lei ou súmula quando aplicável.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
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

    if (!response.text) throw new Error("A IA não retornou dados.");
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Erro ao gerar quiz:", error);
    throw error;
  }
};

export const askBizuTutor = async (history: {role: string, parts: {text: string}[]}[], message: string): Promise<string> => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: MODEL_NAME,
    history: history,
    config: {
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: "Você é o 'BizuBot', o melhor professor de cursinho do Brasil. Você é 'facul na caveira', direto, motivador e especialista em todas as bancas (FGV, Cebraspe, Vunesp). Use gírias de concurseiro ('lei seca', 'vade mecum', 'papiro'). Se o aluno estiver desmotivado, dê um choque de realidade. Responda sempre com formatação Markdown bonita.",
    }
  });

  const response = await chat.sendMessage({ message });
  return response.text || "Sem resposta.";
};

export const generateStudyMaterials = async (count: number = 3): Promise<StudyMaterial[]> => {
  const ai = getAI();
  const topics = [
    "Direito Constitucional", "Direito Administrativo", "Processo Penal", 
    "Raciocínio Lógico", "Informática para Concursos", "Legislação Especial", "Direito Penal", "AFO"
  ];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];

  const prompt = `Gere ${count} materiais de estudo focados em ALTA PERFORMANCE para concursos.
  Sugira materiais sobre: ${randomTopic} ou temas quentes do momento.
  Conteúdo em PT-BR.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
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

    if (!response.text) return [];
    
    const rawMaterials = JSON.parse(response.text);
    
    // Enrich with client-side IDs
    return rawMaterials.map((m: any) => ({
      ...m,
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString().split('T')[0]
    })) as StudyMaterial[];
  } catch (error) {
    console.error("Erro ao gerar materiais:", error);
    return [];
  }
};

export const generateMaterialContent = async (material: StudyMaterial): Promise<string> => {
  const ai = getAI();
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
    model: MODEL_NAME,
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
    }
  });

  return response.text || "Erro ao gerar conteúdo.";
};

export const generateStudyRoutine = async (targetExam: string, hours: number, subjects: string): Promise<StudyRoutine> => {
  const ai = getAI();
  const prompt = `Sou um 'concurseiro' focado em: "${targetExam}".
    Tenho ${hours} horas líquidas por dia.
    Matérias chave: ${subjects}.
    
    Monte um CICLO DE ESTUDOS semanal insano de produtivo.
    Intercale matérias teóricas com questões.
    Domingo é dia de simulado e revisão.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
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

  if (!response.text) throw new Error("Falha ao gerar rotina");
  
  const result = JSON.parse(response.text);
  
  return {
    targetExam,
    hoursPerDay: hours,
    weekSchedule: result.weekSchedule,
    createdAt: new Date()
  };
};