// OpenRouter API Configuration
// Prioritizing the key provided by the user.
const HARDCODED_KEY = "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";

// Models to try in order (Fallback strategy)
const MODELS = [
  "google/gemini-2.0-flash-001",
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemini-flash-1.5"
];

export default async function handler(req, res) {
  // CORS handling
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

  try {
    // 1. Get & Clean API Key
    // Priority: Hardcoded > Environment Variable
    let apiKey = HARDCODED_KEY || process.env.OPENROUTER_API_KEY;
    
    // Critical: Trim whitespace that often comes from copy-pasting
    if (apiKey) apiKey = apiKey.trim();

    if (!apiKey) {
      console.error("[API Error] No API Key found.");
      return res.status(500).json({ 
        error: 'Configuração de API ausente.', 
        details: 'Nenhuma chave de API válida encontrada no servidor.' 
      });
    }

    // 2. Parse Body
    let body = req.body;
    if (!body) {
      return res.status(400).json({ error: 'Request body is missing' });
    }

    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const { action, payload } = body;
    console.log(`[API] Action: ${action} | Key ends with: ...${apiKey.slice(-6)}`);

    let result;
    switch (action) {
      case 'generateQuiz':
        result = await handleRequest(apiKey, payload, generateQuizPrompt);
        break;
      case 'generateMaterials':
        result = await handleRequest(apiKey, payload, generateMaterialsPrompt);
        break;
      case 'generateRoutine':
        result = await handleRequest(apiKey, payload, generateRoutinePrompt);
        break;
      case 'askTutor':
        result = await handleRequest(apiKey, payload, askTutorPrompt, false);
        break;
      case 'generateMaterialContent':
        result = await handleRequest(apiKey, payload, generateContentPrompt, false);
        break;
      case 'updateRadar':
        result = await handleRequest(apiKey, payload, updateRadarPrompt);
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("[API CRITICAL ERROR]:", error);
    return res.status(500).json({ 
        error: error.message || 'Internal Server Error', 
        details: error.toString() 
    });
  }
}

// --- Generic Request Handler with Fallback ---
async function handleRequest(apiKey, payload, promptGenerator, expectJson = true) {
  const messages = promptGenerator(payload);
  
  // Try models in order
  for (const model of MODELS) {
    try {
      console.log(`[API] Trying model: ${model}`);
      return await callOpenRouter(apiKey, model, messages, expectJson);
    } catch (error) {
      console.warn(`[API] Model ${model} failed: ${error.message}`);
      // If it's the last model, throw the error
      if (model === MODELS[MODELS.length - 1]) throw error;
      // Otherwise continue to next model
    }
  }
}

// --- OpenRouter Call ---
async function callOpenRouter(apiKey, model, messages, expectJson) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://bizu.app",
      "X-Title": "Bizu App",
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) throw new Error(`Chave Inválida (401). Verifique o .env.`);
    throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
      throw new Error("Empty response from AI");
  }

  const content = data.choices[0].message.content;

  if (expectJson) {
    return extractJson(content);
  }
  
  // For non-JSON endpoints that expect specific structures
  if (messages[0].content.includes('generateMaterialContent')) {
      return { content };
  }
  
  return { text: content };
}

// --- JSON Extractor ---
function extractJson(text) {
  try {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    
    if (firstBrace === -1 && firstBracket === -1) throw new Error("No JSON found");

    const start = (firstBrace === -1) ? firstBracket : (firstBracket === -1) ? firstBrace : Math.min(firstBrace, firstBracket);
    const lastBrace = text.lastIndexOf('}');
    const lastBracket = text.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);

    const jsonString = text.substring(start, end + 1);
    return JSON.parse(jsonString);
  } catch (e) {
    // Try simple fix for single quotes
    try {
        return JSON.parse(text.substring(text.indexOf('['), text.lastIndexOf(']') + 1).replace(/'/g, '"'));
    } catch(e2) {
        throw new Error("Failed to parse JSON response");
    }
  }
}

// --- Prompt Generators ---

function generateQuizPrompt(config) {
  return [
    { role: "system", content: `Return ONLY valid JSON (Array of objects). NO Markdown. Structure: [{"id":"1","text":"Question?","options":["A","B","C","D"],"correctAnswerIndex":0,"explanation":"..."}]` },
    { role: "user", content: `Create ${config.numberOfQuestions} questions (Difficulty: ${config.difficulty}) about "${config.topic}". Language: PT-BR.` }
  ];
}

function generateMaterialsPrompt({ count }) {
  const topics = ["Direito Constitucional", "Administrativo", "Penal", "Raciocínio Lógico", "Informática"];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  return [
    { role: "system", content: `Return ONLY valid JSON (Array). NO Markdown. Structure: [{"title":"...","category":"...","type":"PDF","duration":"...","summary":"..."}]` },
    { role: "user", content: `Suggest ${count} study materials about: ${randomTopic}. Language: PT-BR.` }
  ];
}

function generateRoutinePrompt({ targetExam, hours, subjects }) {
  return [
    { role: "system", content: `Return ONLY valid JSON. NO Markdown. Structure: {"weekSchedule":[{"day":"...","focus":"...","tasks":[{"subject":"...","activity":"...","duration":"..."}]}]}` },
    { role: "user", content: `Create a weekly schedule for "${targetExam}" (${hours}h/day). Subjects: ${subjects}. Language: PT-BR.` }
  ];
}

function askTutorPrompt({ history, message }) {
  const formattedHistory = history.map(h => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: (h.parts && h.parts[0]) ? h.parts[0].text : ""
  })).filter(h => h.content);

  return [
    { role: "system", content: "You are BizuBot, a brazilian exam tutor. Be helpful, concise and motivating. Use Markdown." },
    ...formattedHistory,
    { role: "user", content: message }
  ];
}

function generateContentPrompt({ material }) {
  return [
    { role: "system", content: `You are a teacher. Create a full educational markdown article.` },
    { role: "user", content: `Create content for: ${material.title} (${material.category}). Include introduction, main topics, and 3 True/False questions at the end. Language: PT-BR.` }
  ];
}

function updateRadarPrompt() {
  const today = new Date().toLocaleDateString('pt-BR');
  return [
    { role: "system", content: `Return ONLY valid JSON (Array). NO Markdown. Structure: [{"id":"1","institution":"...","title":"...","forecast":"...","status":"Previsto","salary":"...","board":"...","url":"..."}]` },
    { role: "user", content: `List 6 major Brazilian public exams expected for 2025/2026. Date: ${today}.` }
  ];
}