import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

// Configuração do Caminho (Necessário para ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicialização do Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parser de JSON nativo do Express
app.use(express.static(join(__dirname, 'dist'))); // Serve o Frontend

// --- Configurações da IA (Google Gemini) ---
const MODEL_NAME = "gemini-2.0-flash"; // Modelo rápido

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Helper para limpar JSON (Remove blocos markdown ```json ... ```)
function cleanJSON(text) {
  if (!text) return "{}";
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s?/, '').replace(/^```\s?/, '').replace(/```$/, '');
  return cleaned;
}

// --- Funções Lógicas da IA ---

async function generateQuiz(ai, { topic, difficulty, numberOfQuestions }) {
  const prompt = `Crie um quiz técnico para concurso público.
  Tópico: ${topic}
  Dificuldade: ${difficulty}
  Quantidade: ${numberOfQuestions} questões.
  
  Retorne APENAS um JSON array. Estrutura de cada item:
  {
    "id": "uuid",
    "text": "Enunciado da questão",
    "options": ["Opção A", "Opção B", "Opção C", "Opção D", "Opção E"],
    "correctAnswerIndex": 0 (inteiro, índice da correta),
    "explanation": "Explicação breve do gabarito"
  }`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      safetySettings: SAFETY_SETTINGS,
    }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function askTutor(ai, { history, message }) {
  // Limita histórico para economizar tokens e evitar erros de payload
  const limitedHistory = history.slice(-10); 
  
  const chat = ai.chats.create({
    model: MODEL_NAME,
    history: limitedHistory,
    config: {
      systemInstruction: "Você é o BizuBot, um mentor especialista em concursos públicos. Seja direto, motivador e didático. Use formatação Markdown.",
      safetySettings: SAFETY_SETTINGS,
    }
  });

  const result = await chat.sendMessage({ message });
  return { text: result.text };
}

async function generateMaterials(ai, { count }) {
  const prompt = `Sugira ${count} tópicos de estudo essenciais para concursos gerais (Administrativo, Policial, Tribunais).
  Retorne APENAS um JSON array. Estrutura:
  {
    "title": "Título do Material",
    "category": "Matéria (Ex: Direito Const.)",
    "type": "ARTICLE" (Sempre use ARTICLE, PDF ou VIDEO),
    "duration": "Tempo estimado (ex: 15 min)",
    "summary": "Resumo de uma linha sobre o que é"
  }`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      safetySettings: SAFETY_SETTINGS,
    }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function generateMaterialContent(ai, { material }) {
  const prompt = `Escreva uma aula completa e didática em formato Markdown sobre: "${material.title}" (${material.category}).
  Use títulos, bullet points e exemplos práticos.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });

  return { content: response.text };
}

async function generateRoutine(ai, { targetExam, hours, subjects }) {
  const prompt = `Crie um cronograma semanal de estudos.
  Objetivo: ${targetExam}
  Horas/dia: ${hours}
  Matérias: ${subjects}
  
  Retorne APENAS JSON com esta estrutura exata:
  {
    "weekSchedule": [
      {
        "day": "Segunda-feira",
        "focus": "Foco do dia",
        "tasks": [
          { "subject": "Matéria", "activity": "Teoria/Questões", "duration": "Tempo" }
        ]
      }
      ... (até Domingo)
    ]
  }`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      safetySettings: SAFETY_SETTINGS,
    }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function updateRadar(ai) {
  const prompt = `Liste 5 concursos quentes (previstos ou abertos) no Brasil para 2025/2026.
  Retorne APENAS um JSON array. Estrutura:
  {
    "institution": "Nome do Órgão",
    "title": "Cargos",
    "forecast": "Previsão (Mês/Ano)",
    "status": "Um destes: Edital Publicado, Banca Definida, Autorizado, Solicitado, Previsto",
    "salary": "Salário estimado",
    "board": "Banca (ou A definir)",
    "url": "Link oficial ou vazio"
  }`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      safetySettings: SAFETY_SETTINGS,
    }
  });

  return JSON.parse(cleanJSON(response.text));
}

// --- Rota Principal da API ---

app.post('/api/gemini', async (req, res) => {
  console.log(`[SERVER] Recebida requisição: ${req.body.action}`);

  // 1. Validação da Chave
  if (!process.env.API_KEY) {
    console.error('[SERVER] ERRO: API_KEY não encontrada.');
    return res.status(500).json({ 
      error: 'API_KEY_MISSING: A chave da API não está configurada no servidor.' 
    });
  }

  const { action, payload } = req.body;
  
  try {
    // Inicializa cliente Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let result;

    // Roteamento de Ações
    switch (action) {
      case 'generateQuiz':
        result = await generateQuiz(ai, payload);
        break;
      case 'askTutor':
        result = await askTutor(ai, payload);
        break;
      case 'generateMaterials':
        result = await generateMaterials(ai, payload);
        break;
      case 'generateMaterialContent':
        result = await generateMaterialContent(ai, payload);
        break;
      case 'generateRoutine':
        result = await generateRoutine(ai, payload);
        break;
      case 'updateRadar':
        result = await updateRadar(ai);
        break;
      default:
        return res.status(400).json({ error: 'Ação inválida.' });
    }

    // Sucesso
    res.json(result);

  } catch (error) {
    console.error('[SERVER] Erro no processamento da IA:', error);
    
    // Tratamento de Erros Comuns
    const errorMessage = error.message || 'Erro desconhecido';
    
    if (errorMessage.includes('429')) {
      return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
    }
    
    res.status(500).json({ 
      error: 'Erro ao processar solicitação na IA.',
      details: errorMessage 
    });
  }
});

// Rota Catch-All para o Frontend (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor BIZU rodando na porta ${PORT}`);
  console.log(`🔑 Status da API Key: ${process.env.API_KEY ? 'OK (Carregada)' : 'FALHA (Não encontrada)'}`);
});
