// OpenRouter API Configuration
// Prioritizing the key provided by the user to fix 401/500 errors immediately.
const API_KEY_PRIORITY = "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";

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
    // 1. Get API Key
    // Use the hardcoded priority key first, then fall back to env var
    const apiKey = API_KEY_PRIORITY || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error("[API Error] No API Key found.");
      return res.status(500).json({ 
        error: 'Configuração de API ausente.', 
        details: 'Nenhuma chave de API válida encontrada no servidor.' 
      });
    }

    // 2. Safety Check: Body existence
    let body = req.body;
    if (!body) {
      return res.status(400).json({ error: 'Request body is missing or empty' });
    }

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

    console.log(`[API] Processing action: ${action} with model ${MODEL_ID}`);

    let result;
    switch (action) {
      case 'generateQuiz':
        result = await handleGenerateQuiz(payload, apiKey);
        break;
      case 'generateMaterials':
        result = await handleGenerateMaterials(payload, apiKey);
        break;
      case 'generateRoutine':
        result = await handleGenerateRoutine(payload, apiKey);
        break;
      case 'askTutor':
        result = await handleAskTutor(payload, apiKey);
        break;
      case 'generateMaterialContent':
        result = await handleMaterialContent(payload, apiKey);
        break;
      case 'updateRadar':
        result = await handleUpdateRadar(apiKey);
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

// --- Helper for OpenRouter API ---
async function callOpenRouter(messages, apiKey, expectJson = true) {
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
      // Captura erros específicos de autenticação
      if (response.status === 401) {
         console.error("[Auth Error] Chave inválida ou usuário não encontrado.");
         throw new Error("Chave da API inválida (Erro 401). A chave hardcoded ou do .env está incorreta.");
      }
      if (response.status === 402) {
         throw new Error("Saldo insuficiente na API (Erro 402). Verifique seus créditos no OpenRouter.");
      }
      throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
        throw new Error("A IA não retornou nenhuma resposta.");
    }

    let content = data.choices[0].message.content;

    if (expectJson) {
      const firstBrace = content.indexOf('{');
      const firstBracket = content.indexOf('[');
      
      if (firstBrace === -1 && firstBracket === -1) {
         throw new Error("A resposta da IA não contém JSON válido.");
      }

      const start = (firstBrace === -1) ? firstBracket : (firstBracket === -1) ? firstBrace : Math.min(firstBrace, firstBracket);
      const lastBrace = content.lastIndexOf('}');
      const lastBracket = content.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);

      if (end === -1) throw new Error("JSON incompleto na resposta da IA.");

      const jsonString = content.substring(start, end + 1);

      try {
        return JSON.parse(jsonString);
      } catch (e) {
          // Fallback para aspas simples
          try {
              const fixedJson = jsonString.replace(/'/g, '"');
              return JSON.parse(fixedJson);
          } catch (e2) {
              console.error("Failed JSON:", jsonString);
              throw new Error("Falha ao processar o JSON retornado pela IA.");
          }
      }
    }

    return content;

  } catch (error) {
    console.error("CallOpenRouter Error:", error.message);
    throw error;
  }
}

// --- Handlers (Receiving apiKey) ---

async function handleGenerateQuiz(config, apiKey) {
  const systemPrompt = `Return ONLY valid JSON (Array of objects). NO Markdown.
  Structure: [{"id":"1","text":"Question?","options":["A","B","C","D"],"correctAnswerIndex":0,"explanation":"..."}]`;
  const userPrompt = `Create ${config.numberOfQuestions} questions (Difficulty: ${config.difficulty}) about "${config.topic}". Language: PT-BR.`;

  return await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], apiKey, true);
}

async function handleGenerateMaterials({ count }, apiKey) {
  const topics = ["Direito Constitucional", "Administrativo", "Penal", "Raciocínio Lógico", "Informática"];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  const systemPrompt = `Return ONLY valid JSON (Array). NO Markdown.
  Structure: [{"title":"...","category":"...","type":"PDF","duration":"...","summary":"..."}]`;
  const userPrompt = `Suggest ${count} study materials about: ${randomTopic}. Language: PT-BR.`;

  return await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], apiKey, true);
}

async function handleGenerateRoutine({ targetExam, hours, subjects }, apiKey) {
  const systemPrompt = `Return ONLY valid JSON. NO Markdown.
  Structure: {"weekSchedule":[{"day":"...","focus":"...","tasks":[{"subject":"...","activity":"...","duration":"..."}]}]`;
  const userPrompt = `Create a weekly schedule for "${targetExam}" (${hours}h/day). Subjects: ${subjects}. Language: PT-BR.`;

  return await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], apiKey, true);
}

async function handleAskTutor({ history, message }, apiKey) {
  const formattedHistory = history.map(h => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: (h.parts && h.parts[0]) ? h.parts[0].text : ""
  })).filter(h => h.content);

  const systemMessage = {
    role: "system",
    content: "You are BizuBot, a brazilian exam tutor. Be helpful, concise and motivating. Use Markdown."
  };

  const messages = [systemMessage, ...formattedHistory, { role: "user", content: message }];

  const responseText = await callOpenRouter(messages, apiKey, false);
  return { text: responseText };
}

async function handleMaterialContent({ material }, apiKey) {
  const systemPrompt = `You are a teacher. Create a full educational markdown article.`;
  const userPrompt = `Create content for: ${material.title} (${material.category}). Include introduction, main topics, and 3 True/False questions at the end. Language: PT-BR.`;

  const content = await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], apiKey, false);

  return { content };
}

async function handleUpdateRadar(apiKey) {
  const today = new Date().toLocaleDateString('pt-BR');
  const systemPrompt = `Return ONLY valid JSON (Array). NO Markdown.
  Structure: [{"id":"1","institution":"...","title":"...","forecast":"...","status":"Previsto","salary":"...","board":"...","url":"..."}]`;
  const userPrompt = `List 6 major Brazilian public exams expected for 2025/2026. Date: ${today}.`;

  return await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], apiKey, true);
}