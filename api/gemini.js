// OpenRouter API Keys provided by user
const KEYS = {
  QWEN: "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",
  MISTRAL: "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"
};

// Model Mapping
const MODELS = {
  // Qwen 2.5 7B Instruct (Traffic)
  TRAFFIC: "qwen/qwen-2.5-7b-instruct", 
  // Mistral Small 3 24B (Noble)
  NOBLE: "mistralai/mistral-small-24b-instruct-2501" 
};

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

  // Ensure body is parsed
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { action, payload } = body;

  try {
    let result;

    // Routing Logic: Traffic vs Noble
    switch (action) {
      // --- TRAFFIC TASKS (Qwen) ---
      case 'generateQuiz':
        result = await handleGenerateQuiz(payload);
        break;
      case 'generateMaterials':
        result = await handleGenerateMaterials(payload);
        break;
      case 'generateRoutine':
        result = await handleGenerateRoutine(payload);
        break;

      // --- NOBLE TASKS (Mistral) ---
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
        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("API Error:", error);
    // Return specific error details to help debugging
    return res.status(500).json({ 
        error: 'Erro no servidor', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// --- Helper for OpenRouter API ---
async function callOpenRouter(model, apiKey, messages, jsonMode = true) {
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
        model: model,
        messages: messages,
        response_format: jsonMode ? { type: "json_object" } : undefined,
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API Status: ${response.status} | Body: ${errText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
        throw new Error("OpenRouter returned no choices.");
    }

    let content = data.choices[0].message.content;

    if (jsonMode) {
      // Robust JSON Extraction
      // Encontra o primeiro '{' ou '[' e o último '}' ou ']'
      const firstBrace = content.indexOf('{');
      const firstBracket = content.indexOf('[');
      const start = (firstBrace === -1) ? firstBracket : (firstBracket === -1) ? firstBrace : Math.min(firstBrace, firstBracket);
      
      const lastBrace = content.lastIndexOf('}');
      const lastBracket = content.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);

      if (start !== -1 && end !== -1) {
        content = content.substring(start, end + 1);
      } else {
        throw new Error("JSON structure not found in response: " + content.substring(0, 100));
      }

      try {
        return JSON.parse(content);
      } catch (e) {
        console.error("JSON Parse Error. Content:", content);
        throw new Error("Failed to parse AI response as JSON.");
      }
    }

    return content;
  } catch (error) {
    console.error("CallOpenRouter Failed:", error);
    throw error;
  }
}

// --- Handlers ---

async function handleGenerateQuiz(config) {
  const systemPrompt = `Você é uma banca examinadora rigorosa.
  Retorne APENAS um JSON válido contendo um Array de objetos.
  Não adicione markdown (code blocks).
  Estrutura: [{ "id": "1", "text": "...", "options": ["A", "B", "C", "D"], "correctAnswerIndex": 0, "explanation": "..." }]`;

  const userPrompt = `Gere ${config.numberOfQuestions} questões de nível ${config.difficulty} sobre "${config.topic}".
  Idioma: PT-BR.`;

  return await callOpenRouter(
    MODELS.TRAFFIC,
    KEYS.QWEN,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  );
}

async function handleGenerateMaterials({ count }) {
  const topics = ["Direito Constitucional", "Administrativo", "Penal", "Raciocínio Lógico", "Informática"];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];

  const systemPrompt = `Você é um curador de conteúdo. Retorne APENAS um JSON válido (Array).
  Estrutura: [{ "title": "...", "category": "...", "type": "PDF", "duration": "...", "summary": "..." }]`;

  const userPrompt = `Sugira ${count} materiais de estudo sobre: ${randomTopic}.`;

  return await callOpenRouter(
    MODELS.TRAFFIC,
    KEYS.QWEN,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  );
}

async function handleGenerateRoutine({ targetExam, hours, subjects }) {
  const systemPrompt = `Você é um coach. Retorne APENAS um JSON válido.
  Estrutura: { "weekSchedule": [{ "day": "...", "focus": "...", "tasks": [{ "subject": "...", "activity": "...", "duration": "..." }] }] }`;

  const userPrompt = `Crie um ciclo semanal para "${targetExam}" com ${hours}h/dia. Matérias: ${subjects}.`;

  return await callOpenRouter(
    MODELS.TRAFFIC,
    KEYS.QWEN,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  );
}

async function handleAskTutor({ history, message }) {
  const formattedHistory = history.map(h => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: (h.parts && h.parts[0]) ? h.parts[0].text : ""
  })).filter(h => h.content); // Remove mensagens vazias

  const systemMessage = {
    role: "system",
    content: "Você é o 'BizuBot', o melhor professor de cursinho do Brasil. Seja direto, motivador e use gírias de concurseiro. Responda em Markdown."
  };

  const messages = [systemMessage, ...formattedHistory, { role: "user", content: message }];

  const responseText = await callOpenRouter(
    MODELS.NOBLE,
    KEYS.MISTRAL,
    messages,
    false
  );

  return { text: responseText };
}

async function handleMaterialContent({ material }) {
  const systemPrompt = `Você é um professor. Crie um conteúdo didático denso em Markdown.`;
  const userPrompt = `Conteúdo para: ${material.title} (${material.category}). Tipo: ${material.type}.
  Cite leis e termine com 3 questões Certo/Errado.`;

  const content = await callOpenRouter(
    MODELS.NOBLE,
    KEYS.MISTRAL,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    false
  );

  return { content };
}

async function handleUpdateRadar() {
  const today = new Date().toLocaleDateString('pt-BR');
  
  const systemPrompt = `Você é um especialista em concursos.
  Retorne APENAS um JSON válido (Array).
  Estrutura: [{ "id": "1", "institution": "...", "title": "...", "forecast": "...", "status": "Previsto", "salary": "...", "board": "...", "url": "..." }]`;

  const userPrompt = `Liste 6 grandes concursos previstos para 2025/2026. Data: ${today}.`;

  return await callOpenRouter(
    MODELS.NOBLE,
    KEYS.MISTRAL,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  );
}
