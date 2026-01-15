// OpenRouter API Key provided by user
const API_KEY = "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";

// Model Mapping - Unificando tudo no Gemini 2.0 Flash (Alta performance e inteligência)
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

  // Parse Body Robusto
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Body não é um JSON válido' });
    }
  }

  const { action, payload } = body;

  try {
    let result;
    console.log(`[API] Processing action: ${action} using Gemini 2.0...`);

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
        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("[API CRITICAL ERROR]:", error);
    return res.status(500).json({ 
        error: 'Erro interno ao processar IA.', 
        details: error.message 
    });
  }
}

// --- Helper for OpenRouter API ---
async function callOpenRouter(messages, expectJson = true) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bizu.app",
        "X-Title": "Bizu App",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: messages,
        // Gemini 2.0 geralmente aceita json_object, mas para garantir compatibilidade máxima
        // mantemos a estratégia de prompt engineering + limpeza manual.
        temperature: 0.7,
        max_tokens: 8000 // Gemini tem contexto maior
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API falhou (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
        throw new Error("A IA não retornou nenhuma resposta.");
    }

    let content = data.choices[0].message.content;

    if (expectJson) {
      // Limpeza agressiva para extrair JSON de texto com Markdown
      const firstBrace = content.indexOf('{');
      const firstBracket = content.indexOf('[');
      
      if (firstBrace === -1 && firstBracket === -1) {
         console.error("JSON não encontrado no texto:", content);
         throw new Error("A resposta da IA não contém um JSON válido.");
      }

      const start = (firstBrace === -1) ? firstBracket : (firstBracket === -1) ? firstBrace : Math.min(firstBrace, firstBracket);
      
      const lastBrace = content.lastIndexOf('}');
      const lastBracket = content.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);

      if (end === -1) {
         throw new Error("JSON incompleto na resposta da IA.");
      }

      const jsonString = content.substring(start, end + 1);

      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.error("Falha ao fazer parse do JSON extraído:", jsonString);
        try {
            // Tenta corrigir aspas simples para duplas se for um erro comum
            const fixedJson = jsonString.replace(/'/g, '"');
            return JSON.parse(fixedJson);
        } catch (e2) {
            throw new Error("Formato JSON inválido retornado pela IA.");
        }
      }
    }

    return content;
  } catch (error) {
    console.error("[CallOpenRouter Error]:", error);
    throw error;
  }
}

// --- Handlers ---

async function handleGenerateQuiz(config) {
  const systemPrompt = `Você é uma banca examinadora de elite (nível Cespe/FGV).
  ATENÇÃO: Retorne APENAS um JSON válido. NÃO use blocos de código markdown (\`\`\`).
  Estrutura obrigatória: Array de objetos.
  Exemplo: [{"id":"1","text":"Enunciado da questão...","options":["Alternativa A","Alternativa B","C","D"],"correctAnswerIndex":0,"explanation":"Explicação detalhada"}]`;

  const userPrompt = `Gere ${config.numberOfQuestions} questões de nível ${config.difficulty} sobre "${config.topic}". Foco em jurisprudência e lei seca. Idioma: PT-BR.`;

  return await callOpenRouter(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    true
  );
}

async function handleGenerateMaterials({ count }) {
  const topics = ["Direito Constitucional", "Administrativo", "Penal", "Raciocínio Lógico", "Informática", "Português"];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];

  const systemPrompt = `Você é um curador de materiais de estudo.
  ATENÇÃO: Retorne APENAS um JSON válido (Array). SEM Markdown.
  Estrutura: [{"title":"Título do Material","category":"Matéria","type":"PDF","duration":"15 min","summary":"Resumo breve..."}]`;

  const userPrompt = `Sugira ${count} materiais de estudo de alto nível sobre: ${randomTopic}. Diversifique entre PDF (Leitura) e Article (Dicas).`;

  return await callOpenRouter(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    true
  );
}

async function handleGenerateRoutine({ targetExam, hours, subjects }) {
  const systemPrompt = `Você é um coach de concursos.
  ATENÇÃO: Retorne APENAS um JSON válido. SEM Markdown.
  Estrutura: {"weekSchedule":[{"day":"Segunda","focus":"Teoria","tasks":[{"subject":"Matéria","activity":"Ler PDF","duration":"1h"}]}]}`;

  const userPrompt = `Crie um ciclo semanal otimizado para "${targetExam}" com ${hours}h/dia. Matérias prioritárias: ${subjects}.`;

  return await callOpenRouter(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    true
  );
}

async function handleAskTutor({ history, message }) {
  const formattedHistory = history.map(h => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: (h.parts && h.parts[0]) ? h.parts[0].text : ""
  })).filter(h => h.content);

  const systemMessage = {
    role: "system",
    content: "Você é o 'BizuBot', o melhor professor de cursinho do Brasil. Seja didático, motive o aluno e use gírias leves de concurseiro (faca na caveira, papiro, bizu). Use Markdown para formatar (negrito, listas)."
  };

  const messages = [systemMessage, ...formattedHistory, { role: "user", content: message }];

  const responseText = await callOpenRouter(
    messages,
    false // Expects text, not JSON
  );

  return { text: responseText };
}

async function handleMaterialContent({ material }) {
  const systemPrompt = `Você é um professor especialista. Crie uma aula completa e estruturada em Markdown.`;
  const userPrompt = `Crie o conteúdo completo para: ${material.title} (${material.category}).
  Formato: Introdução, Tópicos Principais, Jurisprudência Relacionada (se houver), Dicas Práticas e 3 Questões de Fixação (Certo/Errado) no final.`;

  const content = await callOpenRouter(
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
  
  const systemPrompt = `Você é um analista de concursos.
  ATENÇÃO: Retorne APENAS um JSON válido (Array). SEM Markdown.
  Estrutura: [{"id":"1","institution":"Nome","title":"Cargo","forecast":"Previsão","status":"Previsto","salary":"R$ Valor","board":"Banca","url":"Link ou A definir"}]
  Status possíveis: 'Edital Publicado', 'Banca Definida', 'Autorizado', 'Solicitado', 'Previsto'.`;

  const userPrompt = `Liste 6 grandes oportunidades de concursos (Federais/Estaduais) previstos para 2025/2026. Data ref: ${today}.`;

  return await callOpenRouter(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    true
  );
}