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

// --- LISTA DE MODELOS (FALLBACK AUTOMÁTICO) ---
// O sistema tentará estes modelos em ordem. Se o primeiro falhar (404), tenta o próximo.
// Isso garante que sua chave funcione independente da versão liberada para ela.
const MODEL_FALLBACK_LIST = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-001"
];

// Configurações de segurança permissivas
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
  return text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
}

// Inicializa a IA com a chave do ambiente (Sempre lê a variável atual)
function getAI() {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// --- FUNÇÃO "BLINDADA" DE EXECUÇÃO ---
// Tenta executar a ação com o modelo preferido. Se der erro de modelo (404), tenta o próximo.
async function runWithModelFallback(ai, actionCallback) {
  let lastError = null;

  // Se o usuário definiu um modelo específico no Render (AI_MODEL), tenta ele primeiro.
  // Se não, usa a lista padrão.
  const modelsToTry = process.env.AI_MODEL 
    ? [process.env.AI_MODEL, ...MODEL_FALLBACK_LIST] 
    : MODEL_FALLBACK_LIST;

  // Remove duplicatas
  const uniqueModels = [...new Set(modelsToTry)];

  for (const model of uniqueModels) {
    try {
      // console.log(`Tentando modelo: ${model}...`); // Debug (opcional)
      return await actionCallback(model);
    } catch (error) {
      // Se o erro for "Not Found" (404) ou problema de versão do modelo, continua para o próximo
      if (
        error.message && (
          error.message.includes("404") || 
          error.message.includes("not found") || 
          error.message.includes("not supported")
        )
      ) {
        console.warn(`⚠️ Modelo ${model} falhou (404/Incompatível). Tentando próximo...`);
        lastError = error;
        continue; 
      }
      
      // Se for outro erro (ex: quota 429, auth 401), lança imediatamente
      throw error;
    }
  }

  // Se todos falharem
  throw lastError || new Error("Nenhum modelo de IA disponível funcionou com esta chave.");
}

// --- LÓGICA DE NEGÓCIO (ADAPTADA PARA RECEBER O NOME DO MODELO) ---

async function handleGenerateQuiz(ai, modelName, { topic, difficulty, numberOfQuestions }) {
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
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });
  
  return JSON.parse(cleanJSON(response.text));
}

async function handleAskTutor(ai, modelName, { history, message }) {
  const limitedHistory = (history || []).slice(-10);
  
  const chat = ai.chats.create({
    model: modelName,
    history: limitedHistory,
    config: {
      systemInstruction: "Você é o BizuBot, mentor de concursos. Seja direto, motivador e use Markdown.",
      safetySettings: SAFETY_SETTINGS
    }
  });
  
  const result = await chat.sendMessage({ message });
  return { text: result.text };
}

async function handleGenerateMaterials(ai, modelName, { count }) {
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
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleGenerateMaterialContent(ai, modelName, { material }) {
  const prompt = `Crie uma aula completa (formato Markdown) sobre: ${material.title} (${material.category}).`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });

  return { content: response.text };
}

async function handleGenerateRoutine(ai, modelName, { targetExam, hours, subjects }) {
  const prompt = `Crie uma rotina semanal (JSON) para passar no concurso: ${targetExam}. 
  Disponibilidade: ${hours}h/dia. Matérias: ${subjects}.
  Formato: { "weekSchedule": [ { "day": "Segunda", "focus": "...", "tasks": [{ "subject": "...", "activity": "...", "duration": "..." }] } ] }`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleUpdateRadar(ai, modelName) {
  const prompt = `Liste 5 concursos previstos no Brasil (JSON Array).
  Campos: institution, title, forecast, status (Edital Publicado/Autorizado/Previsto), salary, board, url.`;

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
  console.log(`[API] Recebendo ação: ${action}`);

  try {
    const ai = getAI();
    let result;

    // Executa usando o sistema de fallback (tenta vários modelos se necessário)
    await runWithModelFallback(ai, async (modelName) => {
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
                result = await handleGenerateMaterialContent(ai, modelName, payload); 
                break;
            case 'generateRoutine': 
                result = await handleGenerateRoutine(ai, modelName, payload); 
                break;
            case 'updateRadar': 
                result = await handleUpdateRadar(ai, modelName); 
                break;
            default: 
                throw new Error("Ação desconhecida");
        }
    });

    res.json(result);

  } catch (error) {
    console.error(`[API] Erro CRÍTICO em ${action}:`, error);
    
    if (error.message === "API_KEY_MISSING") {
      return res.status(500).json({ error: "ERRO DE CONFIGURAÇÃO: Chave de API não encontrada no servidor." });
    }
    
    if (error.message && error.message.includes("429")) {
      return res.status(429).json({ error: "Muitas requisições. A IA está ocupada, tente em 30 segundos." });
    }
    
    // Se chegou aqui, todos os modelos falharam
    if (error.message && (error.message.includes("404") || error.message.includes("not found"))) {
        return res.status(404).json({ error: "Nenhum modelo de IA compatível foi encontrado para esta chave API." });
    }

    res.status(500).json({ error: "Erro interno na IA. Tente novamente." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ SERVIDOR ONLINE NA PORTA ${PORT}`);
  
  if (process.env.API_KEY) {
    const maskedKey = process.env.API_KEY.substring(0, 5) + "...";
    console.log(`🔑 API Key: ${maskedKey} (OK)`);
    console.log(`🛡️  Sistema de Fallback Ativo: Se um modelo falhar, tentarei outro automaticamente.`);
  } else {
    console.log(`❌ API Key: NÃO ENCONTRADA`);
  }
});
