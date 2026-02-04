import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO AMBIENTE ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Instrução de Sistema (System Prompt) para a IA se comportar como BizuBot
const BIZU_SYSTEM_PROMPT = `Você é o BizuBot, a inteligência artificial oficial do Bizu App.
Sua identidade e missão:
1. Você foi desenvolvido pela equipe de engenharia do Bizu.
2. Você é um Professor Especialista em Concursos Públicos e um Mentor de Estudos altamente capacitado.
3. Sua missão é ajudar concurseiros a alcançarem a aprovação através de explicações claras, técnicas de memorização, criação de materiais de alta qualidade e resolução de dúvidas.
4. NUNCA diga que você é uma IA da Xiaomi ou de qualquer outra empresa. Se perguntarem quem te criou, responda que você é a IA do Bizu.
5. Seja motivador, profissional, organizado e focado em produtividade acadêmica.

DIRETRIZES DE PROFUNDIDADE (OBRIGATÓRIO):
- PROIBIDO ser genérico. Nunca cite apenas "Português" ou "Direito". Cite o tópico específico (ex: "Português: Concordância Nominal e Verbal", "Direito: Artigo 5º - Direitos Individuais").
- Cada explicação deve ser densa. Se um aluno pede um resumo, dê detalhes técnicos, jurisprudência e doutrina.
- O Bizu App é focado em ALTO DESEMPENHO. O conteúdo deve ser nível especialista.

DIRETRIZES PARA MATERIAIS (APOSTILAS E RESUMOS):
- Crie conteúdos densos, profundos e tecnicamente impecáveis.
- RIGOR GRAMATICAL: Em materiais de Português, siga a norma culta e gramáticos renomados (Bechara, Cunha).
- TÉCNICAS DE MEMORIZAÇÃO: Use macetes validados (ex: Macete do "ISSO", Macete do "O QUAL").
- Use Markdown avançado (tabelas densas, negritos para termos-chave, listas, blocos de citação).
- Inclua sempre: Contextualização Jurídica/Técnica, Doutrina, Jurisprudência (se aplicável) e "Bizus de Prova".

DIRETRIZES PARA QUIZ:
- Gere questões desafiadoras, similares às de bancas como FGV, CESPE e FCC.
- As explicações devem ser pedagógicas, ensinando o porquê de cada alternativa estar certa ou errada.

DIRETRIZES PARA ROTINAS:
- Monte cronogramas realistas, focados em Ciclos de Estudo e Revisões Espaçadas.
- DETALHAMENTO DE TAREFAS: Em cada bloco de estudo, especifique exatamente qual sub-tópico estudar. 
  - Errado: "Estudar Direito Constitucional"
  - Correto: "Estudar Direito Constitucional: Poder Constituinte Originário e Derivado + Questões"`;

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES (Devem vir ANTES das rotas) ---
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// --- LISTA UNIVERSAL DE MODELOS ---
// A ordem aqui define a prioridade.
const MODEL_FALLBACK_LIST = [
  "gemini-1.5-flash",       
  "gemini-2.0-flash"
];

const OPENROUTER_MODELS = [
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.1-8b-instruct:free"
];

const GROQ_MODELS = [
  "groq/compound-mini",
  "groq/compound"
];

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- ENDPOINTS DE WEBHOOK (HUBLA) ---

/**
 * Endpoint para receber notificações da Hubla.
 * Configure esta URL no painel da Hubla: https://seu-app.onrender.com/webhooks/hubla
 */
app.post('/webhooks/hubla', async (req, res) => {
  const event = req.body;
  const rawToken = req.headers['x-hubla-token'] || req.headers['authorization'];
  const hublaToken = Array.isArray(rawToken)
    ? rawToken[0]
    : typeof rawToken === 'string'
      ? rawToken.replace(/^Bearer\s+/i, '').trim()
      : undefined;

  // Log para depuração
  console.log('Evento Hubla recebido:', JSON.stringify(event, null, 2));

  try {
    const expectedToken = process.env.HUBLA_WEBHOOK_TOKEN;
    if (expectedToken && (!hublaToken || hublaToken !== expectedToken)) {
      return res.status(401).send('Token inválido');
    }

    const email = event.data?.user?.email || event.data?.customer?.email || event.data?.buyer?.email || event.data?.client?.email || event.data?.email || event.user_email || event.customer_email || event.email;
    const status = event.event_type || event.type || event.event || event.name || event.data?.event_type || event.data?.status || event.status || 'unknown';

    if (!email) {
      console.error('ERRO: Email não encontrado no payload da Hubla:', JSON.stringify(event));
      return res.status(200).send('Webhook recebido, mas sem email para processar'); // Retornamos 200 para a Hubla não ficar tentando reenviar um erro
    }

    // 1. REGISTRAR O EVENTO NA TABELA DE VENDAS (PARA O DASHBOARD)
    const { error: eventError } = await supabase
      .from('sales_events')
      .insert([{
        email: email?.toLowerCase(),
        event_type: status,
        raw_data: event,
        created_at: new Date().toISOString()
      }]);

    if (eventError) {
      console.error('Erro ao registrar evento de venda:', eventError);
    }

    // 2. LOGICA DE ACESSO AO APP (TABELA PROFILES)
    let isActive = false;
    
    // Status que LIBERAM ou MANTÊM o acesso
    const activeStatus = [
      'order_completed', 
      'subscription_renewed', 
      'approved', 
      'subscription_active', 
      'access_granted',
      'payment_confirmed',
      'invoice_paid',
      'purchase_approved'
    ];
    
    // Status que BLOQUEIAM o acesso
    const inactiveStatus = [
      'subscription_cancelled', 
      'refunded', 
      'expired', 
      'access_removed', 
      'chargeback', 
      'subscription_deactivated',
      'payment_failed',
      'order_cancelled'
    ];

    const lowerStatus = status.toLowerCase();
    const isEventActive = activeStatus.some(s => lowerStatus.includes(s)) || activeStatus.includes(lowerStatus);
    const isEventInactive = inactiveStatus.some(s => lowerStatus.includes(s)) || inactiveStatus.includes(lowerStatus);

    if (isEventActive) {
      isActive = true;
      console.log(`✅ [LIBERAÇÃO] Evento "${status}" reconhecido como ATIVO para ${email}`);
    } else if (isEventInactive) {
      isActive = false;
      console.log(`❌ [BLOQUEIO] Evento "${status}" reconhecido como INATIVO para ${email}`);
    } else {
      // Se for um evento de "lead", "carrinho abandonado" ou outro que não mude o acesso
      console.log(`ℹ️ [INFO] Evento informativo recebido: ${status} para ${email}`);
      return res.status(200).send('Evento registrado para o dashboard');
    }

    // Atualiza ou cria o perfil no Supabase apenas para eventos que mudam acesso
    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        email: email.toLowerCase(),
        subscription_active: isActive,
        last_webhook_event: status,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
      .select();

    if (profileError) {
      console.error('🚨 ERRO CRÍTICO ao atualizar perfil via webhook:', profileError);
      return res.status(500).send('Erro interno ao atualizar banco de dados');
    }

    console.log(`✨ SUCESSO: Perfil ${email} atualizado. Status Final: ${isActive ? 'ATIVO ✅' : 'INATIVO ❌'}`);
    res.status(200).send('Webhook processado e acesso garantido');

  } catch (err) {
    console.error('Erro no processamento do webhook:', err);
    res.status(500).send('Erro interno');
  }
});

// --- HELPERS DE PARSEAMENTO ROBUSTO ---

/**
 * Tenta extrair um JSON válido de qualquer string de texto.
 * Funciona mesmo se a IA responder "Aqui está o seu JSON: { ... }"
 */
function extractJSON(text) {
  if (!text) return "{}";

  try {
    // 1. Tenta limpar blocos de código markdown
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. Se já parecer JSON puro, retorna
    if ((cleanText.startsWith('{') && cleanText.endsWith('}')) || 
        (cleanText.startsWith('[') && cleanText.endsWith(']'))) {
      return cleanText;
    }

    // 3. Regex para encontrar o primeiro objeto {} ou array []
    const jsonMatch = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return cleanText;
  } catch (e) {
    console.error("Erro ao extrair JSON:", e);
    return "{}";
  }
}

/**
 * Garante que o retorno seja um array, mesmo se a IA envolver em um objeto
 * Ex: { "questions": [...] } -> [...]
 */
function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // Procura por qualquer propriedade que seja um array
    const possibleArray = Object.values(data).find(val => Array.isArray(val));
    if (possibleArray) return possibleArray;
  }
  return [];
}

function parseSubjectList(input) {
  if (Array.isArray(input)) {
    return input
      .map(s => String(s || "").trim())
      .filter(Boolean);
  }

  return String(input || "")
    .split(/[,;\n]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function countDistinctRoutineSubjects(routine) {
  const subjects = new Set();
  const days = Array.isArray(routine?.weekSchedule) ? routine.weekSchedule : [];

  for (const day of days) {
    const tasks = Array.isArray(day?.tasks) ? day.tasks : [];
    for (const task of tasks) {
      const subject = String(task?.subject || "").trim();
      if (subject) subjects.add(subject.toLowerCase());
    }
  }

  return subjects.size;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getAI() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const openRouterKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  
  if (!geminiKey && !openRouterKey && !groqKey) {
    throw new Error("API_KEY_MISSING");
  }
  
  return {
    gemini: geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null,
    openRouter: openRouterKey ? {
      apiKey: openRouterKey,
      baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.AI_MODEL || 'qwen/qwen3-next-80b-a3b-instruct:free'
    } : null,
    groq: groqKey ? {
      apiKey: groqKey,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'groq/compound-mini'
    } : null,
    preferredProvider: process.env.AI_PROVIDER?.toLowerCase() || (groqKey ? 'groq' : (openRouterKey ? 'openrouter' : 'gemini'))
  };
}

// --- CHAMADA GROQ ---
async function callGroq(config, prompt, isJson = false, history = null, specificModel = null) {
  const headers = {
    "Authorization": `Bearer ${config.apiKey.trim()}`,
    "Content-Type": "application/json"
  };

  const messages = history ? [...history] : [];
  if (prompt) {
    messages.push({ role: "user", content: prompt });
  }

  const body = {
    model: specificModel || config.model,
    messages: [
      { role: "system", content: BIZU_SYSTEM_PROMPT },
      ...messages
    ],
    response_format: isJson ? { type: "json_object" } : undefined,
    temperature: 0.7,
    max_tokens: 4000
  };

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    const rawText = await response.text();
    
    if (!response.ok) {
      let errorMsg = rawText;
      try {
        const errorData = JSON.parse(rawText || "{}");
        errorMsg = errorData.error?.message || rawText;
      } catch (e) {}
      
      if (response.status === 429) throw new Error(`RATE_LIMIT:${errorMsg}`);
      throw new Error(errorMsg || `Erro Groq: ${response.status}`);
    }

    const data = JSON.parse(rawText);
    return { text: data.choices[0].message.content || "" };
  } catch (error) {
    throw error;
  }
}

// --- CHAMADA OPENROUTER (FALLBACK) ---
async function callOpenRouter(config, prompt, isJson = false, history = null, specificModel = null) {
  const headers = {
    "Authorization": `Bearer ${config.apiKey.trim()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://bizu.app",
    "X-Title": "Bizu App"
  };

  const messages = history ? [...history] : [];
  if (prompt) {
    messages.push({ role: "user", content: prompt });
  }

  const body = {
    model: specificModel || config.model,
    messages: [
      { role: "system", content: BIZU_SYSTEM_PROMPT },
      ...messages
    ],
    response_format: isJson ? { type: "json_object" } : undefined,
    temperature: 0.7,
    max_tokens: 4000
  };

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    const rawText = await response.text();
    
    if (!response.ok) {
      let errorMsg = rawText;
      try {
        const errorData = JSON.parse(rawText || "{}");
        errorMsg = errorData.error?.message || rawText;
      } catch (e) {}
      
      if (response.status === 429) throw new Error(`RATE_LIMIT:${errorMsg}`);
      throw new Error(errorMsg || `Erro OpenRouter: ${response.status}`);
    }

    if (!rawText || rawText.trim() === "") throw new Error("Resposta vazia do OpenRouter");

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error("Resposta inválida do OpenRouter (JSON corrompido)");
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Formato de resposta inesperado do OpenRouter");
    }

    return { text: data.choices[0].message.content || "" };
  } catch (error) {
    throw error;
  }
}

// --- EXECUTOR UNIVERSAL COM MULTI-FALLBACK ---
async function runWithModelFallback(ai, actionName, payload) {
  // --- ORDEM DE PRIORIDADE DOS PROVEDORES ---
  // Se a Groq estiver disponível, usaremos APENAS ela conforme solicitado pelo usuário.
  let providersToTry = [];
  if (ai.groq) {
    providersToTry = ['groq']; // Apenas Groq se estiver configurada
  } else {
    providersToTry = ai.preferredProvider === 'openrouter' ? ['openrouter', 'gemini'] : ['gemini', 'openrouter'];
  }

  for (const provider of providersToTry) {
    // --- TENTANDO GROQ ---
    if (provider === 'groq' && ai.groq) {
      for (const model of GROQ_MODELS) {
        try {
          console.log(`[Groq] Tentando ${actionName} com ${model}`);
          
          let prompt = "";
          let isJson = false;
          let history = null;

          if (actionName === 'generateStudyMaterials') {
            const topic = payload.topic || 'Concursos Públicos';
            const count = payload.count || 3;
            let allMaterials = [];

            for (let i = 0; i < count; i++) {
              // 1. Primeiro gera o título e o esqueleto da apostila
              const skeletonPrompt = `Você é o BizuBot. Gere o TÍTULO e uma BREVE INTRODUÇÃO para uma apostila de alto nível sobre "${topic}". 
              A apostila deve ser técnica e detalhada.
              Responda APENAS JSON: { "title": "...", "intro": "..." }`;
              
              const skeletonRes = await callGroq(ai.groq, skeletonPrompt, true, null, model);
              const skeleton = JSON.parse(extractJSON(skeletonRes.text));

              // 2. Gera o conteúdo denso em 3 partes para garantir tamanho e profundidade
              let fullContent = skeleton.intro + "\n\n";
              const parts = ["Conceitos Fundamentais e Doutrina", "Desenvolvimento Técnico e Detalhamento", "Bizus de Prova, Jurisprudência e Resumo Final"];

              for (const part of parts) {
                const contentPrompt = `Você é o Professor Especialista do Bizu. 
                Escreva a parte de "${part}" para a apostila intitulada "${skeleton.title}".
                FOCO: Máxima profundidade, tabelas Markdown, termos técnicos em negrito e exemplos práticos.
                Não economize nas palavras. Seja denso.
                Retorne apenas o texto em Markdown.`;
                
                const contentRes = await callGroq(ai.groq, contentPrompt, false, null, model);
                fullContent += `## ${part}\n\n` + contentRes.text + "\n\n";
                await sleep(2000); // Pausa para evitar rate limit
              }

              allMaterials.push({
                id: Date.now() + i,
                title: skeleton.title,
                content: fullContent,
                category: topic,
                timestamp: new Date()
              });
            }
            return allMaterials;
          } else if (actionName === 'generateQuiz') {
            const batchSize = 5; // Reduzido para 5 para ser mais seguro com o limite de tokens da Groq
            const totalQuestions = Math.min(payload.numberOfQuestions, 100);
            let allQuestions = [];
            const numBatches = Math.ceil(totalQuestions / batchSize);

            for (let i = 0; i < numBatches; i++) {
              const currentBatchSize = Math.min(batchSize, totalQuestions - allQuestions.length);
              if (currentBatchSize <= 0) break;

              const batchPrompt = `Você é um Professor e Gerador de Questões do Bizu. 
              Gere ${currentBatchSize} questões de nível "${payload.difficulty}" sobre "${payload.topic}". 
              ESTE É O LOTE ${i + 1} DE ${numBatches}.
              Responda APENAS JSON. Schema: [{id, text, options:[], correctAnswerIndex:number, explanation}]`;
              
              let success = false;
              let retryCount = 0;
              while (!success && retryCount < 3) {
                try {
                  const res = await callGroq(ai.groq, batchPrompt, true, null, model);
                  const batchQuestions = ensureArray(JSON.parse(extractJSON(res.text)));
                  allQuestions = [...allQuestions, ...batchQuestions];
                  success = true;
                  // Pequena pausa entre lotes para evitar Rate Limit
                  if (numBatches > 1) await sleep(2000);
                } catch (err) {
                  retryCount++;
                  if (err.message.includes("RATE_LIMIT") || err.message.includes("429")) {
                    console.log(`[Groq] Rate limit atingido no lote ${i+1}. Esperando 10 segundos...`);
                    await sleep(10000); // Espera 10 segundos antes de tentar novamente
                  } else {
                    throw err;
                  }
                }
              }
            }
            return allQuestions;
          } else if (actionName === 'askTutor') {
            history = (payload.history || []).map(m => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.parts[0].text
            }));
            prompt = payload.message;
          } else if (actionName === 'generateMaterials') {
            prompt = `Você é um Especialista em Concursos. Liste ${payload.count} materiais de estudo de alta qualidade.
            Os materiais devem ser do tipo: "Apostila Completa" ou "Resumo Estratégico".
            JSON Array: [{"title": "Título da Apostila", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas", "summary": "Breve resumo do que será abordado"}]`;
            isJson = true;
          } else if (actionName === 'generateMaterialContent') {
            prompt = `Você é um Professor de Cursinho Preparatório.
            Gere uma APOSTILA ou RESUMO DE ESTUDO completo em Markdown para o tema: "${payload.material.title}".
            
            ESTRUTURA OBRIGATÓRIA:
            1. Título Chamativo (H1)
            2. Introdução ao Tema
            3. Tópicos Detalhados (H2 e H3)
            4. Dicas de Ouro para Concursos (Destaque)
            5. Resumo Final (Bullet points)
            6. Referências ou Base Legal (se houver)
            
            Use Markdown rico: negrito, tabelas, listas e blocos de citação. Foque em clareza e organização para impressão.`;
          } else if (actionName === 'generateRoutine') {
            prompt = `Você é um Mentor de Concursos especialista em Ciclos de Estudo.
            Crie um CRONOGRAMA DE ESTUDO semanal completo para o concurso: "${payload.targetExam}".
            Disponibilidade: ${payload.hours} horas por dia.
            Matérias prioritárias: ${Array.isArray(payload.subjects) ? payload.subjects.join(", ") : payload.subjects}.
            
            Schema JSON: {
              "title": "Nome do Plano",
              "description": "Resumo da estratégia",
              "weekSchedule": [
                {
                  "day": "Segunda-feira",
                  "focus": "Foco do dia",
                  "tasks": [{"subject": "Matéria", "duration": "tempo", "activity": "O que fazer"}]
                }
              ]
            }`;
            isJson = true;
          } else if (actionName === 'updateRadar') {
            const today = new Date().toLocaleDateString('pt-BR');
            const existingTitles = Array.isArray(payload?.existingTitles) ? payload.existingTitles.join(", ") : "Nenhum";
            prompt = `Você é um Analista de Concursos. Hoje é dia ${today}.
            Liste 5 concursos IMPORTANTES de 2026 que NÃO estão nesta lista: [${existingTitles}].
            Se não houver NADA novo de 2026 para adicionar, responda APENAS: {"no_updates": true}.
            Caso contrário, envie o JSON Array: [{"institution":"Nome","title":"Cargo","forecast":"Previsão","status":"Previsto","salary":"R$","board":"Banca","url":""}]`;
            isJson = true;
          } else if (actionName === 'createCustomMaterial') {
            prompt = `Você é um Especialista em Concursos. Crie um material de estudo estratégico baseado no seguinte tema: "${payload.topic}".
            JSON Object: {"title": "Título", "category": "Disciplina", "type": "PDF", "duration": "Tempo", "summary": "Resumo"}`;
            isJson = true;
          }

          const res = await callGroq(ai.groq, prompt, isJson, history, model);
          if (isJson) {
            const parsed = JSON.parse(extractJSON(res.text));
            return actionName === 'generateQuiz' || actionName === 'generateMaterials' || actionName === 'updateRadar' 
              ? ensureArray(parsed) 
              : parsed;
          }
          return actionName === 'generateMaterialContent' ? { content: res.text } : res;
        } catch (error) {
          console.warn(`⚠️ Groq ${model} falhou: ${error.message}.`);
          if (error.message.includes("RATE_LIMIT")) break;
          continue;
        }
      }
    }

    // --- TENTANDO GEMINI ---
    if (provider === 'gemini' && ai.gemini) {
      let modelsToTry = [...MODEL_FALLBACK_LIST];
      if (process.env.AI_MODEL && !process.env.AI_MODEL.includes("/")) {
        modelsToTry = [process.env.AI_MODEL, ...modelsToTry.filter(m => m !== process.env.AI_MODEL)];
      }

      for (const model of modelsToTry) {
        try {
          console.log(`[Gemini] Tentando ${actionName} com ${model}`);
          if (actionName === 'generateQuiz') return await handleGenerateQuiz(ai.gemini, model, payload);
          if (actionName === 'askTutor') return await handleAskTutor(ai.gemini, model, payload);
          if (actionName === 'generateMaterials') return await handleGenerateMaterials(ai.gemini, model, payload);
          if (actionName === 'generateMaterialContent') return await handleGenerateMaterialContent(ai.gemini, model, payload);
          if (actionName === 'generateRoutine') return await handleGenerateRoutine(ai.gemini, model, payload);
          if (actionName === 'updateRadar') return await handleUpdateRadar(ai.gemini, model, payload);
        } catch (error) {
          if (error.message.includes("429") || error.message.includes("Quota")) {
            console.warn(`⚠️ Gemini ${model} limitado. Tentando próximo modelo Gemini...`);
            continue;
          }
          console.error(`❌ Erro no Gemini (${model}):`, error.message);
          break; // Sai do loop de modelos Gemini e tenta o próximo provedor
        }
      }
    }

    // --- TENTANDO OPENROUTER ---
    if (provider === 'openrouter' && ai.openRouter) {
      let models = [ai.openRouter.model, ...OPENROUTER_MODELS.filter(m => m !== ai.openRouter.model)];
      let attempts = 0;
      const MAX_ATTEMPTS = 2; // Limita a apenas 2 modelos para evitar demora excessiva

      for (const model of models) {
        if (attempts >= MAX_ATTEMPTS) break;
        attempts++;

        try {
          console.log(`[OpenRouter] Tentando ${actionName} com ${model}`);
          
          let prompt = "";
          let isJson = false;
          let history = null;

          if (actionName === 'generateQuiz') {
            const batchSize = 10;
            const totalQuestions = Math.min(payload.numberOfQuestions, 100);
            let allQuestions = [];
            const numBatches = Math.ceil(totalQuestions / batchSize);

            for (let i = 0; i < numBatches; i++) {
              const currentBatchSize = Math.min(batchSize, totalQuestions - allQuestions.length);
              if (currentBatchSize <= 0) break;

              const batchPrompt = `Você é um Professor e Gerador de Questões do Bizu. 
              Gere ${currentBatchSize} questões sobre "${payload.topic}" (${payload.difficulty}). 
              ESTE É O LOTE ${i + 1} DE ${numBatches}.
              Responda APENAS JSON. Schema: [{id, text, options:[], correctAnswerIndex:number, explanation}]`;
              
              const res = await callOpenRouter(ai.openRouter, batchPrompt, true, null, model);
              const batchQuestions = ensureArray(JSON.parse(extractJSON(res.text)));
              allQuestions = [...allQuestions, ...batchQuestions];
            }
            return allQuestions;
          } else if (actionName === 'askTutor') {
            history = (payload.history || []).map(m => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.parts[0].text
            }));
            prompt = payload.message;
          } else if (actionName === 'generateMaterials') {
            prompt = `Você é um Especialista em Concursos. Liste ${payload.count} materiais de estudo de alta qualidade.
            Os materiais devem ser do tipo: "Apostila Completa" ou "Resumo Estratégico".
            JSON Array: [{"title": "Título da Apostila", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas", "summary": "Breve resumo do que será abordado"}]`;
            isJson = true;
          } else if (actionName === 'generateMaterialContent') {
            prompt = `Você é um Professor de Cursinho Preparatório.
            Gere uma APOSTILA ou RESUMO DE ESTUDO completo em Markdown para o tema: "${payload.material.title}".
            
            ESTRUTURA OBRIGATÓRIA:
            1. Título Chamativo (H1)
            2. Introdução ao Tema
            3. Tópicos Detalhados (H2 e H3)
            4. Dicas de Ouro para Concursos (Destaque)
            5. Resumo Final (Bullet points)
            6. Referências ou Base Legal (se houver)
            
            Use Markdown rico: negrito, tabelas, listas e blocos de citação. Foque em clareza e organização para impressão.`;
          } else if (actionName === 'generateRoutine') {
            prompt = `Você é um Mentor de Concursos especialista em Ciclos de Estudo.
            Crie um CRONOGRAMA DE ESTUDO semanal completo para o concurso: "${payload.targetExam}".
            Disponibilidade: ${payload.hours} horas por dia.
            Matérias prioritárias (dar mais tempo e mais recorrência): ${Array.isArray(payload.subjects) ? payload.subjects.join(", ") : payload.subjects}.
            
            REGRA DE OURO: a lista acima NÃO é a lista completa do edital. Mesmo que venha só 1 matéria (ex: "Português"), você deve completar com outras matérias essenciais e típicas do concurso/cargo informado em "${payload.targetExam}".
            Distribua a semana em ciclo, with a(s) matéria(s) prioritária(s) aparecendo(em) mais vezes, sem excluir as demais.
            MÍNIMO: inclua pelo menos 5 matérias distintas ao longo da semana.
            
            REGRAS CRÍTICAS DE TEMPO E PROPORÇÃO:
            1. QUESTÕES: Cada questão deve levar em média 1.5 a 2 minutos. Ex: Um quiz de 10 questões deve ter duração de 15 a 20 minutos.
            2. TEORIA: Blocos de teoria devem ter entre 40 a 60 minutos.
            3. REVISÃO: Blocos de revisão rápida devem ter de 15 a 30 minutos.
            4. COERÊNCIA: Garanta que a soma das durações das tarefas não ultrapasse a disponibilidade de ${payload.hours}h diárias.
            
            Schema JSON: {
              "title": "Nome do Plano",
              "description": "Resumo da estratégia",
              "weekSchedule": [
                {
                  "day": "Segunda-feira",
                  "focus": "Foco do dia",
                  "tasks": [{"subject": "Matéria", "duration": "tempo", "activity": "O que fazer"}]
                }
              ]
            }`;
            isJson = true;
          } else if (actionName === 'updateRadar') {
            const today = new Date().toLocaleDateString('pt-BR');
            const existingTitles = Array.isArray(payload?.existingTitles) ? payload.existingTitles.join(", ") : "Nenhum";
            prompt = `Você é um Analista de Concursos. Hoje é dia ${today}.
            Liste 5 concursos IMPORTANTES de 2026 que NÃO estão nesta lista: [${existingTitles}].
            Se não houver NADA novo de 2026 para adicionar, responda APENAS: {"no_updates": true}.
            Caso contrário, envie o JSON Array: [{"institution":"Nome","title":"Cargo","forecast":"Previsão","status":"Previsto","salary":"R$","board":"Banca","url":""}]`;
            isJson = true;
          } else if (actionName === 'createCustomMaterial') {
            prompt = `Você é um Especialista em Concursos. Crie um material de estudo estratégico baseado no seguinte tema: "${payload.topic}".
            JSON Object: {"title": "Título", "category": "Disciplina", "type": "PDF", "duration": "Tempo", "summary": "Resumo"}`;
            isJson = true;
          }

          const res = await callOpenRouter(ai.openRouter, prompt, isJson, history, model);
          if (isJson) {
            const parsed = JSON.parse(extractJSON(res.text));
            if (actionName === 'generateRoutine') {
              const minDistinct = Math.max(5, Math.min(10, parseSubjectList(payload.subjects).length + 3));
              if (countDistinctRoutineSubjects(parsed) < minDistinct) {
                throw new Error("ROUTINE_LOW_DIVERSITY");
              }
            }
            return actionName === 'generateQuiz' || actionName === 'generateMaterials' || actionName === 'updateRadar' 
              ? ensureArray(parsed) 
              : parsed;
          }
          return actionName === 'generateMaterialContent' ? { content: res.text } : res;
        } catch (error) {
          console.warn(`⚠️ OpenRouter ${model} falhou: ${error.message}.`);
          
          // Se for limite de taxa, não adianta tentar outros modelos free no mesmo provedor
          if (error.message.includes("RATE_LIMIT")) {
            console.warn("🛑 Limite de taxa atingido no OpenRouter. Pulando para o próximo provedor...");
            break; 
          }

          // Se o modelo não existe, pula para o próximo
          if (error.message.includes("No endpoints found")) {
            continue;
          }

          continue;
        }
      }
    }
  }

  throw new Error("Todas as IAs e modelos (Groq, Gemini e OpenRouter) atingiram o limite de uso.");
}

// --- AÇÕES ---

async function handleGenerateQuiz(genAI, modelName, { topic, difficulty, numberOfQuestions }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const batchSize = 10;
  const totalQuestions = Math.min(numberOfQuestions, 100);
  let allQuestions = [];
  
  const numBatches = Math.ceil(totalQuestions / batchSize);
  
  for (let i = 0; i < numBatches; i++) {
    const currentBatchSize = Math.min(batchSize, totalQuestions - allQuestions.length);
    if (currentBatchSize <= 0) break;

    const prompt = `Você é um Professor e Gerador de Questões do Bizu.
    Tarefa: Criar ${currentBatchSize} questões de nível "${difficulty}" sobre o tema "${topic}".
    ESTE É O LOTE ${i + 1} DE ${numBatches}.
    
    REQUISITOS DAS QUESTÕES:
    1. ESTILO DE BANCA: As questões devem seguir o padrão de bancas renomadas (FGV, CESPE, FCC).
    2. DISTRATORES FORTES: As alternativas incorretas devem ser plausíveis.
    3. EXPLICAÇÃO PEDAGÓGICA: Explique detalhadamente no campo "explanation".
    4. DIFERENCIAÇÃO: Garanta que estas questões sejam diferentes das anteriores se houver.
    
    Responda APENAS o JSON Array.
    Schema: [{"id": "uuid", "text": "enunciado", "options": ["A", "B", "C", "D", "E"], "correctAnswerIndex": 0, "explanation": "..."}]`;
    
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const batchQuestions = ensureArray(JSON.parse(extractJSON(text)));
      allQuestions = [...allQuestions, ...batchQuestions];
    } catch (err) {
      console.error(`Erro no lote ${i + 1}:`, err);
      if (allQuestions.length > 0) break; // Se já tiver algumas questões, retorna o que tem
      throw err;
    }
  }

  return allQuestions;
}

async function handleAskTutor(genAI, modelName, { history, message }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    safetySettings: SAFETY_SETTINGS
  });

  const chat = model.startChat({
    history: (history || []).slice(-6)
  });
  
  const result = await chat.sendMessage(message);
  return { text: result.response.text() };
}

async function handleGenerateMaterials(genAI, modelName, { count }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prompt = `Você é um Especialista em Concursos. Liste ${count} materiais de estudo de alta qualidade.
  Os materiais devem ser do tipo: "Apostila Completa" ou "Resumo Estratégico".
  JSON Array: [{"title": "Título da Apostila", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas", "summary": "Breve resumo do que será abordado"}]`;
  const result = await model.generateContent(prompt);
  return ensureArray(JSON.parse(extractJSON(result.response.text())));
}

async function handleGenerateMaterialContent(genAI, modelName, { material }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName, 
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.4, // Menor temperatura para maior precisão técnica
      maxOutputTokens: 4000, // Garante que o material seja longo e completo
    },
    safetySettings: SAFETY_SETTINGS 
  });
  const prompt = `Você é um Professor e Autor de Materiais Didáticos de Alto Nível para Concursos de Elite.
  Sua missão é produzir uma APOSTILA ACADÊMICA, EXAUSTIVA e PROFISSIONAL sobre: "${material.title}".
  
  REGRAS TÉCNICAS INEGOCIÁVEIS:
  1. PRECISÃO TOTAL: Se o tema for Língua Portuguesa, use a Nomenclatura Gramatical Brasileira (NGB). Diferencie rigorosamente Coordenativas de Subordinativas.
  2. MACETES DE OURO: Para Conjunções Integrantes (que/se), explique o macete de substituir a oração por "ISSO". Para Pronomes Relativos, o macete de substituir por "O QUAL".
  3. VÍCIOS DE LINGUAGEM: Defina corretamente Pleonasmo Vicioso, Ambiguidade (Anfibologia), Anacoluto, Zeugma e Solecismo com exemplos reais de prova.
  4. NÃO TRUNCAR: O texto deve ter começo, meio e fim. Se o tema for vasto, priorize a profundidade nos pontos mais cobrados.
  
  ESTRUTURA OBRIGATÓRIA:
  1. # Título Estratégico
  2. ## 1. Introdução e Importância para Provas (Explique como as bancas cobram)
  3. ## 2. Desenvolvimento Teórico Aprofundado (Mínimo de 3 sub-tópicos ###)
  4. ## 3. Tabela de Classificação e Exemplos (Tabela Markdown detalhada)
  5. ## 4. Quadro de Diferenciação (Ex: "Isso" vs "O Qual", "Mas" vs "Mais", etc)
  6. ## 5. Bizus de Prova e Alertas de Pegadinha (> Blockquotes com foco em FGV/CESPE)
  7. ## 6. Questão de Concurso Comentada (Inédita ou de Banca)
  8. ## 7. Resumo em Checklist para Revisão Final
  
  Inicie o texto diretamente no Título (H1). Escreva de forma fluida, sem introduções vazias.`;
  const result = await model.generateContent(prompt);
  return { content: result.response.text() };
}

async function handleGenerateRoutine(genAI, modelName, { targetExam, hours, subjects }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName, 
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prioritySubjects = parseSubjectList(subjects);
  const minDistinct = Math.max(5, Math.min(10, prioritySubjects.length + 3));

  const prompt = `Você é um Mentor de Concursos especialista em Ciclos de Estudo.
  Crie um CRONOGRAMA DE ESTUDO semanal completo para o concurso: "${targetExam}".
  Disponibilidade: ${hours} horas por dia.
  Matérias prioritárias (dar mais tempo e mais recorrência): ${Array.isArray(subjects) ? subjects.join(", ") : subjects}.
  
  REGRA DE OURO: a lista acima NÃO é a lista completa do edital. Mesmo que venha só 1 matéria (ex: "Português"), você deve completar com outras matérias essenciais e típicas do concurso/cargo informado em "${targetExam}".
  Distribua a semana em ciclo, com a(s) matéria(s) prioritária(s) aparecendo(em) mais vezes, sem excluir as demais.
  MÍNIMO: inclua pelo menos ${minDistinct} matérias distintas ao longo da semana.
  
  REGRAS CRÍTICAS DE TEMPO E PROPORÇÃO:
  1. QUESTÕES: Cada questão deve levar em média 1.5 a 2 minutos. Ex: Um quiz de 10 questões deve ter duração de 15 a 20 minutos.
  2. TEORIA: Blocos de teoria devem ter entre 40 a 60 minutos.
  3. REVISÃO: Blocos de revisão rápida devem ter de 15 a 30 minutos.
  4. COERÊNCIA: Garanta que a soma das durações das tarefas não ultrapasse a disponibilidade de ${hours}h diárias.
  
  ESTRATÉGIA DE MENTORIA:
  1. ESTRUTURA SEMANAL: O JSON deve conter um array "weekSchedule" com 7 dias (Segunda a Domingo).
  2. EQUILÍBRIO: Distribua as horas baseando-se na complexidade das matérias.
  3. REVISÕES: Inclua blocos específicos para Revisão Espaçada.
  
  Responda APENAS o JSON.
  Schema: {
    "title": "Nome do Plano",
    "description": "Resumo da estratégia",
    "weekSchedule": [
      {
        "day": "Segunda-feira",
        "focus": "Foco do dia",
        "tasks": [{"subject": "Matéria", "duration": "tempo", "activity": "O que fazer"}]
      }
    ]
  }`;
  
  let parsed;
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptPrompt = attempt === 0
      ? prompt
      : `${prompt}

RESTRIÇÕES ADICIONAIS (REFORÇO):
- Se vier só 1 matéria na lista de prioridade, NÃO faça rotina só dela.
- Garanta pelo menos ${minDistinct} matérias distintas ao longo da semana.
- Segunda a sábado: inclua pelo menos 2 matérias diferentes por dia.`;

    const result = await model.generateContent(attemptPrompt);
    const text = result.response.text();
    parsed = JSON.parse(extractJSON(text));

    if (countDistinctRoutineSubjects(parsed) >= minDistinct) break;
  }

  if (countDistinctRoutineSubjects(parsed) < minDistinct) {
    throw new Error("ROUTINE_LOW_DIVERSITY");
  }

  return parsed;
}

async function handleUpdateRadar(genAI, modelName, payload) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const today = new Date().toLocaleDateString('pt-BR');
  const existingTitles = Array.isArray(payload?.existingTitles) ? payload.existingTitles.join(", ") : "Nenhum";

  const prompt = `Você é um Analista de Concursos. Hoje é dia ${today}.
  Sua tarefa é listar os 5 concursos mais importantes e recentes (previstos ou com edital aberto) para o ano de 2026 no Brasil.
  
  REGRAS CRÍTICAS:
  1. FOCO TEMPORAL: Apenas concursos que ocorrerão ou terão edital a partir de hoje (${today}).
  2. NOVIDADE: NÃO inclua nenhum destes concursos que já estão na lista: [${existingTitles}].
  3. SE NÃO HOUVER NOVIDADES: Se todos os concursos relevantes de 2026 já estiverem na lista acima e não houver NADA de novo ou mais importante para adicionar, responda APENAS: {"no_updates": true}.
  4. FORMATO: Se houver novidades, responda um JSON Array com exatamente 5 itens.
  
  Schema (se houver novidade): [{"institution":"Nome","title":"Cargo","forecast":"Previsão","status":"Previsto/Edital Aberto","salary":"R$","board":"Banca","url":""}]
  Schema (se NÃO houver novidade): {"no_updates": true}`;

  const result = await model.generateContent(prompt);
  const text = extractJSON(result.response.text());
  const parsed = JSON.parse(text);

  if (parsed.no_updates) {
    return { no_updates: true };
  }

  return ensureArray(parsed);
}

async function handleCreateCustomMaterial(genAI, modelName, { topic }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prompt = `Você é um Especialista em Concursos. Crie um material de estudo estratégico baseado no seguinte tema: "${topic}".
  
  JSON Object: {
    "title": "Título Profissional e Específico",
    "category": "Disciplina (ex: Português, Direito Administrativo, etc)",
    "type": "PDF",
    "duration": "Tempo estimado de estudo ou páginas",
    "summary": "Breve resumo técnico do que será abordado na apostila completa"
  }`;
  
  const result = await model.generateContent(prompt);
  return JSON.parse(extractJSON(result.response.text()));
}

// --- ROTAS ---

app.post('/api/gemini', async (req, res) => {
  const { action, payload } = req.body;
  
  try {
    const ai = getAI();
    const result = await runWithModelFallback(ai, action, payload);

    if (!result) {
      throw new Error("A IA não retornou dados para esta ação.");
    }

    res.json(result);

  } catch (error) {
    console.error(`[Erro API] ${action}:`, error.message);
    
    if (error.message.includes("API_KEY")) {
      return res.status(500).json({ error: "Chave API inválida ou não configurada." });
    }
    
    // Tratamento genérico para erros de JSON parse (comum em IAs instáveis)
    if (error instanceof SyntaxError) {
       return res.status(500).json({ error: "A IA gerou uma resposta inválida. Tente novamente." });
    }

    res.status(503).json({ error: "Serviço de IA indisponível. Tente novamente em alguns segundos." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor Universal Bizu rodando na porta ${PORT}`);
});
