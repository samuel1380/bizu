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

// --- LISTA DE MODELOS (ORDEM DE EFICIÊNCIA) ---
// O Gemini 1.5 Flash costuma ter limites maiores no tier gratuito que o 3.0 Preview.
// Reorganizei para tentar manter qualidade x estabilidade.
const MODEL_FALLBACK_LIST = [
  "gemini-3-flash-preview",    // Mais rápido (Prioridade)
  "gemini-2.0-flash",          // Muito estável
  "gemini-1.5-flash-latest",   // Fallback robusto (nome corrigido)
  "gemini-1.5-pro-latest"      // Último recurso (mais lento, mas potente)
];

// Configurações de segurança
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getAI() {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

// --- FUNÇÃO "BLINDADA" DE EXECUÇÃO COM RETRY INTELIGENTE ---
async function runWithModelFallback(ai, actionCallback) {
  let lastError = null;

  // Se o usuário definiu modelo fixo, usa ele. Se não, usa a lista.
  const modelsToTry = process.env.AI_MODEL 
    ? [process.env.AI_MODEL, ...MODEL_FALLBACK_LIST] 
    : MODEL_FALLBACK_LIST;

  const uniqueModels = [...new Set(modelsToTry)];

  for (const model of uniqueModels) {
    // Tenta cada modelo até 2 vezes se for erro de taxa (429)
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            // console.log(`Tentando ${model} (Tentativa ${attempt})...`);
            return await actionCallback(model);
        } catch (error) {
            const errorMessage = error.message || "";
            lastError = error;

            // 1. Erro de Modelo não encontrado (404) -> Pula para o próximo modelo imediatamente
            if (errorMessage.includes("404") || errorMessage.includes("not found")) {
                console.warn(`⚠️ Modelo ${model} indisponível (404). Pulando...`);
                break; // Sai do loop de tentativas e vai para o próximo modelo
            }

            // 2. Erro de Cota/Sobrecarga (429 ou 503)
            if (errorMessage.includes("429") || errorMessage.includes("Quota") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("503")) {
                // Se for a primeira tentativa, espera e tenta de novo o MESMO modelo
                if (attempt === 1) {
                    console.warn(`⏳ Cota excedida no ${model}. Esfriando por 5 segundos...`);
                    await sleep(5000); // 5 segundos de espera (Crucial para Free Tier)
                    continue; // Tenta de novo
                } else {
                    // Se falhou na segunda, espera um pouco e vai para o PRÓXIMO modelo
                    console.warn(`⚠️ ${model} falhou 2x. Trocando de modelo...`);
                    await sleep(2000); 
                    break;
                }
            }
            
            // Outros erros (JSON inválido, Safety, etc) -> Lança erro
            throw error;
        }
    }
  }

  console.error("❌ Esgotadas todas as tentativas de modelos.");
  throw new Error("Sistema sobrecarregado. Por favor, aguarde 30 segundos antes de tentar novamente.");
}

// --- LÓGICA DE NEGÓCIO OTIMIZADA ---

async function handleGenerateQuiz(ai, modelName, { topic, difficulty, numberOfQuestions }) {
  const prompt = `Gere JSON com ${numberOfQuestions} questões: "${topic}" (${difficulty}).
  Schema: [{"id":"uuid","text":"P","options":["A","B","C","D","E"],"correctAnswerIndex":0,"explanation":"E"}]`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });
  
  return JSON.parse(cleanJSON(response.text));
}

async function handleAskTutor(ai, modelName, { history, message }) {
  // OTIMIZAÇÃO CRÍTICA: Reduzir histórico para economizar tokens e evitar 429
  // Envia apenas as últimas 2 interações (User + Bot) + a mensagem atual
  const limitedHistory = (history || []).slice(-2); 
  
  const chat = ai.chats.create({
    model: modelName,
    history: limitedHistory,
    config: {
      systemInstruction: "Seja o BizuBot. Responda em Markdown. Seja curto e útil.",
      safetySettings: SAFETY_SETTINGS
    }
  });
  
  const result = await chat.sendMessage({ message });
  
  const responseText = result.text;
  
  if (!responseText || responseText.trim().length === 0) {
      if (result.candidates && result.candidates.length > 0 && result.candidates[0].finishReason !== 'STOP') {
         return { text: "⚠️ Resposta bloqueada por segurança. Tente reformular." };
      }
      return { text: "⚠️ Ocorreu um erro silencioso na IA. Tente novamente." };
  }

  return { text: responseText };
}

async function handleGenerateMaterials(ai, modelName, { count }) {
  const prompt = `Liste ${count} materiais (PDF/ARTICLE) sobre concursos. Sem vídeos.
  Schema: [{"title":"T","category":"C","type":"PDF","duration":"15 pág","summary":"S"}]`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleGenerateMaterialContent(ai, modelName, { material }) {
  const prompt = `Crie APOSTILA PDF (Markdown) sobre: ${material.title}.
  Estrutura: Intro, Tópicos, Exemplos, Conclusão.`;
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { safetySettings: SAFETY_SETTINGS }
  });

  return { content: response.text };
}

async function handleGenerateRoutine(ai, modelName, { targetExam, hours, subjects }) {
  const prompt = `Cronograma ${targetExam} (${hours}h). Foco: ${subjects}.
  JSON: { "weekSchedule": [ { "day": "Segunda", "focus": "Foco", "tasks": [{ "subject": "M", "activity": "A", "duration": "D" }] } ] }`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { responseMimeType: "application/json", safetySettings: SAFETY_SETTINGS }
  });

  return JSON.parse(cleanJSON(response.text));
}

async function handleUpdateRadar(ai, modelName) {
  const prompt = `5 concursos BRASIL recentes.
  Schema: [{"institution":"I","title":"C","forecast":"D","status":"Edital Publicado","salary":"R$","board":"B","url":""}]`;

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
  console.log(`[API] Ação: ${action}`);

  try {
    const ai = getAI();
    let result;

    await runWithModelFallback(ai, async (modelName) => {
        switch (action) {
            case 'generateQuiz': result = await handleGenerateQuiz(ai, modelName, payload); break;
            case 'askTutor': result = await handleAskTutor(ai, modelName, payload); break;
            case 'generateMaterials': result = await handleGenerateMaterials(ai, modelName, payload); break;
            case 'generateMaterialContent': result = await handleGenerateMaterialContent(ai, modelName, payload); break;
            case 'generateRoutine': result = await handleGenerateRoutine(ai, modelName, payload); break;
            case 'updateRadar': result = await handleUpdateRadar(ai, modelName); break;
            default: throw new Error("Ação desconhecida");
        }
    });

    res.json(result);

  } catch (error) {
    console.error(`[API] Erro Final:`, error.message);
    
    if (error.message === "API_KEY_MISSING") {
      return res.status(500).json({ error: "Chave API não configurada." });
    }

    // Retorna 429 para o frontend saber que é sobrecarga
    if (error.message.includes("aguarde")) {
        return res.status(429).json({ error: "Muitas requisições. Aguarde 30s." });
    }
    
    res.status(500).json({ error: "Erro no servidor de IA." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor (V3 Resiliente) na porta ${PORT}`);
});
