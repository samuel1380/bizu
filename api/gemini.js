// OpenRouter API Keys provided by user
const KEYS = {
  QWEN: "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",
  MISTRAL: "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"
};

// Model Mapping
const MODELS = {
  // "Qwen3 4B" -> Using Qwen 2.5 7B Instruct (Fast, Efficient)
  TRAFFIC: "qwen/qwen-2.5-7b-instruct", 
  // "Mistral 24B" -> Using Mistral Small 24B Instruct
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

  const { action, payload } = req.body;

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
    console.error("OpenRouter Error:", error);
    return res.status(500).json({ error: 'Erro ao processar solicitação', details: error.message });
  }
}

// --- Helper for OpenRouter API ---
async function callOpenRouter(model, apiKey, messages, jsonMode = true) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://bizu.app", // OpenRouter requirement
      "X-Title": "Bizu App",
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      response_format: jsonMode ? { type: "json_object" } : undefined,
      temperature: 0.7,
      max_tokens: 4000 // Limit to prevent huge costs/latency
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API Error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content;

  if (jsonMode) {
    // Clean Markdown code blocks if present
    content = content.replace(/^```json\s?/, '').replace(/^```\s?/, '').replace(/```$/, '');
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error("JSON Parse Error:", content);
      throw new Error("Failed to parse AI response as JSON");
    }
  }

  return content;
}

// --- Handlers ---

async function handleGenerateQuiz(config) {
  const systemPrompt = `Você é uma banca examinadora (estilo CEBRASPE/FGV). 
  Retorne APENAS um JSON válido.
  Estrutura: Array de objetos { id, text, options (array de 4 strings), correctAnswerIndex (0-3), explanation }.`;

  const userPrompt = `Gere ${config.numberOfQuestions} questões de nível ${config.difficulty} sobre "${config.topic}".
  Idioma: PT-BR. Foco em lei seca e jurisprudência.`;

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

  const systemPrompt = `Você é um curador de conteúdo para concursos. Retorne APENAS um JSON válido (Array).
  Estrutura: [{ title, category, type (PDF/VIDEO/ARTICLE), duration, summary }].`;

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
  const systemPrompt = `Você é um coach de estudos. Retorne APENAS um JSON válido.
  Estrutura: { weekSchedule: [{ day, focus, tasks: [{ subject, activity, duration }] }] }.`;

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
  // Convert Gemini history format to OpenRouter format if needed
  // Gemini: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
  // OpenRouter: [{ role: 'user'|'assistant', content: '...' }]
  
  const formattedHistory = history.map(h => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: h.parts[0].text
  }));

  const systemMessage = {
    role: "system",
    content: "Você é o 'BizuBot', o melhor professor de cursinho do Brasil. Seja direto, motivador e use gírias de concurseiro ('faca na caveira', 'papiro'). Responda em Markdown."
  };

  const messages = [systemMessage, ...formattedHistory, { role: "user", content: message }];

  const responseText = await callOpenRouter(
    MODELS.NOBLE,
    KEYS.MISTRAL,
    messages,
    false // Not JSON mode, chat mode
  );

  return { text: responseText };
}

async function handleMaterialContent({ material }) {
  const systemPrompt = `Você é um professor de elite. Crie um conteúdo didático completo, denso e formatado em Markdown.`;
  const userPrompt = `Crie o conteúdo para: ${material.title} (${material.category}). Tipo: ${material.type}.
  Cite leis, dê exemplos e termine com 3 questões Certo/Errado.`;

  const content = await callOpenRouter(
    MODELS.NOBLE,
    KEYS.MISTRAL,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    false // Markdown output
  );

  return { content };
}

async function handleUpdateRadar() {
  const today = new Date().toLocaleDateString('pt-BR');
  
  const systemPrompt = `Você é um especialista em concursos públicos no Brasil.
  Retorne APENAS um JSON válido com estrutura:
  Array de [{ id, institution, title, forecast, status, salary, board, url }].
  Status permitidos: 'Edital Publicado', 'Banca Definida', 'Autorizado', 'Solicitado', 'Previsto'.
  
  IMPORTANTE: Como você não tem acesso a busca em tempo real agora, use seu conhecimento mais recente para projetar oportunidades prováveis para 2025/2026 com base nos ciclos tradicionais (PF, PRF, Receita, Tribunais).
  No campo 'url', coloque o link oficial da instituição ou 'A definir'.`;

  const userPrompt = `Liste 6 grandes concursos previstos para 2025/2026. Data de referência: ${today}.`;

  return await callOpenRouter(
    MODELS.NOBLE,
    KEYS.MISTRAL,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  );
}
