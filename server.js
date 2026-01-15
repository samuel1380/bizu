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

// --- CONFIGURAÇÃO DA IA ---
// Usando 1.5-Flash: Melhor balanceamento entre velocidade e cota gratuita
const MODEL_NAME = "gemini-1.5-flash";

// Configurações de segurança permissivas para evitar bloqueios falsos em conteúdo educativo
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

// Limpa blocos de código markdown (```json) que a IA às vezes retorna
function cleanJSON(text) {
  if (!text) return "{}";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

// Inicializa a IA com a chave do ambiente
function getAI() {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// --- PROMPTS E LÓGICA DE NEGÓCIO ---

async function handleGenerateQuiz(ai, { topic, difficulty, numberOfQuestions }) {
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
    model: MODEL_NAME,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });
  
  return JSON.parse(cleanJSON(response.text));
}

async function handleAskTutor(ai, { history, message }) {
  // Mantém apenas as últimas 10 mensagens para economizar tokens
  const limitedHistory = (history || []).slice(-10);
  
  const chat = ai.chats.create({
    model: MODEL_NAME,
    history: limitedHistory,
    config: {
      systemInstruction: "Você é o BizuBot, mentor de concursos. Seja direto, motivador e use Markdown.",
      safetySettings: SAFETY_SETTINGS
    }
  });
  
  const result = await chat.sendMessage({ message });
  return { text: result.text };
}

async function handleGenerateMaterials(ai, { count }) {
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
    model: MODEL_NAME,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleGenerateMaterialContent(ai, { material }) {
  const prompt = `Crie uma aula completa (formato Markdown) sobre: ${material.title} (${material.category}).`;
  
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });

  return { content: response.text };
}

async function handleGenerateRoutine(ai, { targetExam, hours, subjects }) {
  const prompt = `Crie uma rotina semanal (JSON) para passar no concurso: ${targetExam}. 
  Disponibilidade: ${hours}h/dia. Matérias: ${subjects}.
  Formato: { "weekSchedule": [ { "day": "Segunda", "focus": "...", "tasks": [{ "subject": "...", "activity": "...", "duration": "..." }] } ] }`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleUpdateRadar(ai) {
  const prompt = `Liste 5 concursos previstos no Brasil (JSON Array).
  Campos: institution, title, forecast, status (Edital Publicado/Autorizado/Previsto), salary, board, url.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
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

    // Retry simples (1 tentativa extra se falhar)
    try {
      switch (action) {
        case 'generateQuiz': result = await handleGenerateQuiz(ai, payload); break;
        case 'askTutor': result = await handleAskTutor(ai, payload); break;
        case 'generateMaterials': result = await handleGenerateMaterials(ai, payload); break;
        case 'generateMaterialContent': result = await handleGenerateMaterialContent(ai, payload); break;
        case 'generateRoutine': result = await handleGenerateRoutine(ai, payload); break;
        case 'updateRadar': result = await handleUpdateRadar(ai); break;
        default: return res.status(400).json({ error: "Ação desconhecida" });
      }
    } catch (innerError) {
      console.warn(`[API] Falha na primeira tentativa (${action}), tentando novamente...`);
      // Pequeno delay e retry
      await new Promise(r => setTimeout(r, 1500));
      // Switch duplicado para retry (simples e eficaz)
      switch (action) {
        case 'generateQuiz': result = await handleGenerateQuiz(ai, payload); break;
        case 'askTutor': result = await handleAskTutor(ai, payload); break;
        case 'generateMaterials': result = await handleGenerateMaterials(ai, payload); break;
        case 'generateMaterialContent': result = await handleGenerateMaterialContent(ai, payload); break;
        case 'generateRoutine': result = await handleGenerateRoutine(ai, payload); break;
        case 'updateRadar': result = await handleUpdateRadar(ai); break;
      }
    }

    res.json(result);

  } catch (error) {
    console.error(`[API] Erro CRÍTICO em ${action}:`, error);
    
    if (error.message === "API_KEY_MISSING") {
      return res.status(500).json({ error: "ERRO DE CONFIGURAÇÃO: Chave de API não encontrada no servidor." });
    }
    
    if (error.message && error.message.includes("429")) {
      return res.status(429).json({ error: "Muitas requisições. Aguarde um momento." });
    }

    res.status(500).json({ error: "Erro interno na IA. Tente novamente." });
  }
});

// Rota Catch-All para React Router (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// --- INICIALIZAÇÃO ---
app.listen(PORT, () => {
  console.log(`✅ SERVIDOR REINICIADO NA PORTA ${PORT}`);
  console.log(`🤖 Modelo: ${MODEL_NAME}`);
  
  if (process.env.API_KEY) {
    const maskedKey = process.env.API_KEY.substring(0, 5) + "...";
    console.log(`🔑 API Key detectada: ${maskedKey} (OK)`);
  } else {
    console.log(`❌ API Key NÃO detectada! Verifique as Variáveis de Ambiente.`);
  }
});
