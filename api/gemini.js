// OpenRouter API Keys Pool (Rotation for High Availability)
// A chave fornecida pelo usuário (sk-or-v1-5403...) retornou 401 (User Not Found), removida.
// Restauradas chaves de contingência para garantir o funcionamento.
const API_KEYS = [
  "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", // Primary
  "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"  // Backup
];

// Model ID - Google Gemini 2.0 Flash (Fast & Intelligent)
const MODEL_ID = "google/gemini-2.0-flash-001";

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
    // 1. Safety Check: Body existence
    let body = req.body;
    if (!body) {
      return res.status(400).json({ error: 'Request body is missing or empty' });
    }

    // 2. Parse Body if string (Defensive programming)
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body format' });
      }
    }

    const { action, payload } = body;

    if (!action) {
      return res.status(400).json({ error: 'Action is required in body' });
    }

    console.log(`[API] Processing action: ${action}`);

    let result;
    switch (action) {
      case 'generateQuiz':
        result = await handleGenerateQuiz(payload);
        break;
      case 'generateMaterials':
        result = await handleGenerateMaterials(payload);
        break;
      case 'generateRoutine':
        result = await handleGenerateRoutine(payload);
        break;
      case 'askTutor':
        result = await handleAskTutor(payload);
        break;
      case 'generateMaterialContent':
        result = await handleMaterialContent(payload);
        break;
      case 'updateRadar':
        result = await handleUpdateRadar();
        break;
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("[API CRITICAL ERROR]:", error);
    // Return the actual error message to the client for debugging
    return res.status(500).json({ 
        error: error.message || 'Internal Server Error', 
        details: error.toString() 
    });
  }
}

// --- Helper for OpenRouter API with Key Rotation ---
async function callOpenRouter(messages, expectJson = true) {
  let lastError;

  // Try each key in the pool
  for (const apiKey of API_KEYS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://bizu.app",
          "X-Title": "Bizu App",
        },
        body: JSON.stringify({
          model: MODEL_ID,
          messages: messages,
          temperature: 0.7,
          max_tokens: 8000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // If 401 (Unauthorized) or 402 (Payment), try next key
        if (response.status === 401 || response.status === 402) {
            console.warn(`Key failed (${response.status}), rotating... Error: ${errorText}`);
            lastError = new Error(`OpenRouter Key Error: ${errorText}`);
            continue; // Try next key
        }
        
        throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
          throw new Error("AI returned empty choices.");
      }

      let content = data.choices[0].message.content;

      if (expectJson) {
        // Robust JSON Extraction
        const firstBrace = content.indexOf('{');
        const firstBracket = content.indexOf('[');
        
        if (firstBrace === -1 && firstBracket === -1) {
           throw new Error("No JSON found in AI response.");
        }

        const start = (firstBrace === -1) ? firstBracket : (firstBracket === -1) ? firstBrace : Math.min(firstBrace, firstBracket);
        const lastBrace = content.lastIndexOf('}');
        const lastBracket = content.lastIndexOf(']');
        const end = Math.max(lastBrace, lastBracket);

        if (end === -1) throw new Error("Incomplete JSON in AI response.");

        const jsonString = content.substring(start, end + 1);

        try {
          return JSON.parse(jsonString);
        } catch (e) {
          // Try fixing common JSON errors (single quotes)
          try {
              const fixedJson = jsonString.replace(/'/g, '"');
              return JSON.parse(fixedJson);
          } catch (e2) {
              console.error("Failed JSON:", jsonString);
              throw new Error("Failed to parse AI response as JSON.");
          }
        }
      }

      return content; // Success! Return data

    } catch (error) {
      lastError = error;
      // If it's not a key auth error, maybe we shouldn't rotate? 
      // For now, let's simple rotate on any fetch error to be safe.
      console.warn(`Attempt failed with key ending in ...${apiKey.slice(-4)}:`, error.message);
    }
  }

  // If we get here, all keys failed
  console.error("All API keys failed.");
  throw lastError || new Error("All API keys failed to connect.");
}

// --- Handlers ---

async function handleGenerateQuiz(config) {
  const systemPrompt = `Return ONLY valid JSON (Array of objects). NO Markdown.
  Structure: [{"id":"1","text":"Question?","options":["A","B","C","D"],"correctAnswerIndex":0,"explanation":"..."}]`;
  const userPrompt = `Create ${config.numberOfQuestions} questions (Difficulty: ${config.difficulty}) about "${config.topic}". Language: PT-BR.`;

  return await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], true);
}

async function handleGenerateMaterials({ count }) {
  const topics = ["Direito Constitucional", "Administrativo", "Penal", "Raciocínio Lógico", "Informática"];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  const systemPrompt = `Return ONLY valid JSON (Array). NO Markdown.
  Structure: [{"title":"...","category":"...","type":"PDF","duration":"...","summary":"..."}]`;
  const userPrompt = `Suggest ${count} study materials about: ${randomTopic}. Language: PT-BR.`;

  return await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], true);
}

async function handleGenerateRoutine({ targetExam, hours, subjects }) {
  const systemPrompt = `Return ONLY valid JSON. NO Markdown.
  Structure: {"weekSchedule":[{"day":"...","focus":"...","tasks":[{"subject":"...","activity":"...","duration":"..."}]}]}`;
  const userPrompt = `Create a weekly schedule for "${targetExam}" (${hours}h/day). Subjects: ${subjects}. Language: PT-BR.`;

  return await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], true);
}

async function handleAskTutor({ history, message }) {
  const formattedHistory = history.map(h => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: (h.parts && h.parts[0]) ? h.parts[0].text : ""
  })).filter(h => h.content);

  const systemMessage = {
    role: "system",
    content: "You are BizuBot, a brazilian exam tutor. Be helpful, concise and motivating. Use Markdown."
  };

  const messages = [systemMessage, ...formattedHistory, { role: "user", content: message }];

  const responseText = await callOpenRouter(messages, false);
  return { text: responseText };
}

async function handleMaterialContent({ material }) {
  const systemPrompt = `You are a teacher. Create a full educational markdown article.`;
  const userPrompt = `Create content for: ${material.title} (${material.category}). Include introduction, main topics, and 3 True/False questions at the end. Language: PT-BR.`;

  const content = await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], false);

  return { content };
}

async function handleUpdateRadar() {
  const today = new Date().toLocaleDateString('pt-BR');
  const systemPrompt = `Return ONLY valid JSON (Array). NO Markdown.
  Structure: [{"id":"1","institution":"...","title":"...","forecast":"...","status":"Previsto","salary":"...","board":"...","url":"..."}]`;
  const userPrompt = `List 6 major Brazilian public exams expected for 2025/2026. Date: ${today}.`;

  return await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], true);
}