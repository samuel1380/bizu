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
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Instrução de Sistema (System Prompt) para a IA se comportar como BizuBot
const BIZU_SYSTEM_PROMPT = `Você é o BizuBot, a inteligência artificial oficial do Bizu App.
Sua identidade e missão:
1. Você foi desenvolvido pela equipe de engenharia do Bizu.
2. Você é um Mentor de Estudos e Professor Especialista altamente capacitado.
3. Sua missão é ajudar estudantes (Concurseiros, Vestibulandos e alunos do ENEM) a alcançarem a aprovação através de explicações claras, técnicas de memorização, criação de materiais de alta qualidade e resolução de dúvidas.
4. NUNCA diga que você é uma IA da Xiaomi ou de qualquer outra empresa. Se perguntarem quem te criou, responda que você é a IA do Bizu.
5. Seja motivador, profissional, organizado e focado em produtividade acadêmica.

DETECÇÃO DE PERFIL (OBRIGATÓRIO):
- Identifique se o objetivo do usuário é CONCURSO PÚBLICO ou ENEM/VESTIBULAR/ACADÊMICO baseado nos termos fornecidos (ex: "Polícia", "FGV", "INSS" -> Concurso; "ENEM", "Fuvest", "Vestibular", "Medicina" -> Acadêmico).
- Adapte sua linguagem, profundidade e referências de acordo com o perfil identificado.

DIRETRIZES DE PROFUNDIDADE (OBRIGATÓRIO):
- PROIBIDO ser genérico. Nunca cite apenas "Português" ou "Matemática". Cite o tópico específico (ex: "Português: Concordância Nominal e Verbal", "Biologia: Genética Mendeliana").
- Para CONCURSOS: Dê detalhes técnicos, jurisprudência e doutrina.
- Para ENEM/VESTIBULAR: Foque em conceitos fundamentais, interdisciplinaridade, aplicação prática e recorrência nos exames.
- O Bizu App é focado em ALTO DESEMPENHO. O conteúdo deve ser nível especialista para o público-alvo.

DIRETRIZES PARA MATERIAIS (APOSTILAS E RESUMOS):
- Crie conteúdos densos, profundos e tecnicamente impecáveis.
- RIGOR GRAMATICAL: Siga a norma culta. Para redação (ENEM/Vestibular), forneça dicas de estrutura e competências.
- TÉCNICAS DE MEMORIZAÇÃO: Use macetes validados (ex: Macete do "ISSO", Macete do "O QUAL", mnemônicos de biologia/história).
- Use Markdown avançado (tabelas densas, negritos para termos-chave, listas, blocos de citação).
- Include sempre: Contextualização (Jurídica/Técnica ou Histórica/Social), Teoria Detalhada, "Bizus de Prova" e, para ENEM, uma seção de "Interdisciplinaridade".

DIRETRIZES DE ESTRATÉGIA (OBRIGATÓRIO PARA MATERIAIS):
- ESTRATÉGIA DE ESTUDO: Em cada apostila, você DEVE incluir uma seção detalhada sobre COMO estudar aquele tema, ciclos de revisão sugeridos e como organizar o aprendizado.
- ESTRATÉGIA DE PROVA: Forneça orientações específicas sobre como a banca ou o exame (FGV, CESPE, ENEM, Fuvest, etc.) cobra o assunto, quais as "pegadinhas" comuns e como eliminar alternativas.
- FOCO EM RESULTADO: O conteúdo deve preparar o aluno para acertar a questão na hora da prova.

DIRETRIZES PARA QUIZ:
- Gere questões desafiadoras.
- Para CONCURSOS: Estilo múltipla escolha ou Certo/Errado (estilo CESPE/FGV).
- Para ENEM: Questões baseadas em competências e habilidades, com textos de apoio e situações-problema.
- As explicações devem ser pedagógicas, ensinando o porquê de cada alternativa estar certa ou errada.

DIRETRIZES PARA ROTINAS:
- Monte cronogramas realistas, focados em Ciclos de Estudo e Revisões Espaçadas.
- DETALHAMENTO DE TAREFAS: Em cada bloco de estudo, especifique exatamente qual sub-tópico estudar. 
  - Errado: "Estudar Biologia"
  - Correto: "Estudar Biologia: Citologia - Membrana Plasmática e Transportes + Questões"`;

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
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it"
];

const MISTRAL_MODELS = [
  "mistral-large-2411",
  "pixtral-12b-2409",
  "open-mistral-nemo"
];

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
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

    let email = event.data?.user?.email || 
        event.data?.customer?.email || 
        event.data?.buyer?.email || 
        event.data?.client?.email || 
        event.data?.email || 
        event.user?.email || 
        event.customer?.email || 
        event.buyer?.email || 
        event.client?.email || 
        event.user_email || 
        event.customer_email || 
        event.email;
        
    let status = event.event_type || 
        event.type || 
        event.event || 
        event.name || 
        event.data?.event_type || 
        event.data?.status || 
        event.status || 
        'unknown';

    if (!email) {
      console.error('ERRO: Email não encontrado no payload da Hubla:', JSON.stringify(event));
      return res.status(200).send('Webhook recebido, mas sem email para processar'); // Retornamos 200 para a Hubla não ficar tentando reenviar um erro
    }

    email = email.trim().toLowerCase();

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
    let subscriptionType = 'trial'; // default
    
    // Status que LIBERAM ou MANTÊM o acesso (Busca por palavras-chave para ser ultra-flexível)
    const activeKeywords = [
      'completed', 'approved', 'renewed', 'active', 'granted', 'confirmed', 'paid', 'success'
    ];
    
    // Status que BLOQUEIAM o acesso
    const inactiveKeywords = [
      'cancelled', 'refunded', 'expired', 'removed', 'chargeback', 'deactivated', 'failed'
    ];

    const lowerStatus = status.toLowerCase();
    const isEventActive = activeKeywords.some(kw => lowerStatus.includes(kw));
    const isEventInactive = inactiveKeywords.some(kw => lowerStatus.includes(kw));

    if (isEventActive) {
      isActive = true;
      
      // Lógica para definir o período baseado no produto ou recorrência
      const productName = (
        event.data?.product_name || 
        event.data?.product?.name || 
        event.product_name || 
        event.product?.name || 
        event.data?.offer?.name || 
        event.offer?.name || 
        ''
      ).toLowerCase();

      const interval = (
        event.data?.subscription?.interval || 
        event.subscription?.interval || 
        event.data?.interval || 
        event.interval || 
        ''
      ).toLowerCase();
      
      const trialEndsAt = new Date();
      
      if (productName.includes('anual') || interval === 'year' || interval === 'yearly') {
        trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 1);
        subscriptionType = 'anual';
      } else if (productName.includes('trimestral') || interval === 'quarter' || interval === '3_months') {
        trialEndsAt.setMonth(trialEndsAt.getMonth() + 3);
        subscriptionType = 'trimestral';
      } else {
        // Padrão: Mensal (ou 30 dias)
        trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);
        subscriptionType = 'mensal';
      }

      console.log(`✅ [LIBERAÇÃO] Evento "${status}" reconhecido como ATIVO para ${email}. Expira em: ${trialEndsAt.toISOString()}`);
      
      // Atualiza o perfil com a nova data de expiração e status ativo
      // O campo subscription_active deve ser TRUE para indicar que é uma assinatura paga
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          email: email.trim().toLowerCase(),
          subscription_active: true, // Prioridade máxima: Assinatura paga
          subscription_type: subscriptionType,
          trial_ends_at: trialEndsAt.toISOString(), 
          last_webhook_event: status,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });

      if (profileError) {
        console.error('❌ ERRO CRÍTICO ao atualizar perfil ativo via Webhook:', profileError);
        // Tentar um segundo método de segurança caso o upsert falhe
        const { error: secondTryError } = await supabase
          .from('profiles')
          .update({ 
            subscription_active: true, 
            subscription_type: subscriptionType,
            trial_ends_at: trialEndsAt.toISOString(),
            last_webhook_event: status,
            updated_at: new Date().toISOString()
          })
          .eq('email', email.trim().toLowerCase());
          
        if (secondTryError) console.error('❌ Falha na segunda tentativa de atualização:', secondTryError);
      }

    } else if (isEventInactive) {
      isActive = false;
      console.log(`❌ [BLOQUEIO] Evento "${status}" reconhecido como INATIVO para ${email}`);
      
      // Se a assinatura foi cancelada ou expirou, removemos o acesso imediato
      // mas mantemos o registro da última data por segurança
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          email: email.toLowerCase(),
          subscription_active: false,
          last_webhook_event: status,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
        
      if (profileError) console.error('Erro ao desativar perfil:', profileError);
    } else {
      // Se for um evento de "lead", "carrinho abandonado" ou outro que não mude o acesso
      console.log(`ℹ️ [INFO] Evento informativo recebido: ${status} para ${email}`);
      // Vamos pelo menos registrar na tabela de vendas
      return res.status(200).send('Evento registrado para o dashboard');
    }

    res.status(200).send('Webhook processado com sucesso');

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
  const mistralKey = process.env.MISTRAL_API_KEY;
  
  if (!geminiKey && !openRouterKey && !groqKey && !mistralKey) {
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
      model: 'llama-3.3-70b-versatile'
    } : null,
    mistral: mistralKey ? {
      apiKey: mistralKey,
      baseUrl: 'https://api.mistral.ai/v1',
      model: 'mistral-large-2411'
    } : null,
    preferredProvider: process.env.AI_PROVIDER?.toLowerCase() || (geminiKey ? 'gemini' : (mistralKey ? 'mistral' : (groqKey ? 'groq' : 'openrouter')))
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

// --- CHAMADA MISTRAL ---
async function callMistral(config, prompt, isJson = false, history = null, specificModel = null) {
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
      throw new Error(errorMsg || `Erro Mistral: ${response.status}`);
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
  // Prioridade 1: Gemini (Pelo limite massivo de tokens e estabilidade)
  // Prioridade 2: Mistral (Reforço de 1 Bilhão de tokens)
  // Prioridade 3: Groq (Pela velocidade quando houver limite disponível)
  let providersToTry = ['gemini', 'mistral', 'groq', 'openrouter'];
  
  if (ai.preferredProvider && providersToTry.includes(ai.preferredProvider)) {
    providersToTry = [ai.preferredProvider, ...providersToTry.filter(p => p !== ai.preferredProvider)];
  }

  // Se a ação for relacionada a materiais, coloca o Gemini como prioridade máxima
  // mas mantém o preferredProvider se ele estiver na lista de prioridades
  if (actionName === 'generateMaterials' || actionName === 'generateMaterialContent' || actionName === 'createCustomMaterial' || actionName === 'generateStudyMaterials') {
    const basePriority = ['gemini', 'mistral', 'groq', 'openrouter'];
    if (ai.preferredProvider && basePriority.includes(ai.preferredProvider)) {
      providersToTry = [ai.preferredProvider, ...basePriority.filter(p => p !== ai.preferredProvider)];
    } else {
      providersToTry = basePriority;
    }
  }

  for (const provider of providersToTry) {
    try {
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
            if (actionName === 'extendMaterialContent') return await handleExtendMaterialContent(ai.gemini, model, payload);
            if (actionName === 'generateStudyMaterials') return await handleGenerateStudyMaterials(ai.gemini, model, payload);
            if (actionName === 'createCustomMaterial') return await handleCreateCustomMaterial(ai.gemini, model, payload);
            if (actionName === 'generateRoutine') return await handleGenerateRoutine(ai.gemini, model, payload);
            if (actionName === 'updateRadar') return await handleUpdateRadar(ai.gemini, model, payload);
          } catch (error) {
            if (error.message.includes("429") || error.message.includes("Quota") || error.message.includes("exhausted")) {
              console.warn(`⚠️ Gemini ${model} atingiu limite. Aguardando 60 segundos para resetar...`);
              await sleep(60000);
              
              try {
                console.log(`[Gemini] Retentando ${actionName} com ${model} após espera...`);
                if (actionName === 'generateQuiz') return await handleGenerateQuiz(ai.gemini, model, payload);
                if (actionName === 'askTutor') return await handleAskTutor(ai.gemini, model, payload);
                if (actionName === 'generateMaterials') return await handleGenerateMaterials(ai.gemini, model, payload);
                if (actionName === 'generateMaterialContent') return await handleGenerateMaterialContent(ai.gemini, model, payload);
                if (actionName === 'extendMaterialContent') return await handleExtendMaterialContent(ai.gemini, model, payload);
                if (actionName === 'generateStudyMaterials') return await handleGenerateStudyMaterials(ai.gemini, model, payload);
                if (actionName === 'createCustomMaterial') return await handleCreateCustomMaterial(ai.gemini, model, payload);
                if (actionName === 'generateRoutine') return await handleGenerateRoutine(ai.gemini, model, payload);
                if (actionName === 'updateRadar') return await handleUpdateRadar(ai.gemini, model, payload);
              } catch (retryError) {
                console.warn(`⚠️ Gemini ${model} falhou novamente após espera: ${retryError.message}.`);
              }
            }
            console.warn(`⚠️ Gemini ${model} falhou: ${error.message}.`);
            continue; 
          }
        }
      }

      // --- TENTANDO MISTRAL ---
      if (provider === 'mistral' && ai.mistral) {
        for (const model of MISTRAL_MODELS) {
          try {
            console.log(`[Mistral] Tentando ${actionName} com ${model}`);
            
            let prompt = "";
            let isJson = false;
            let history = null;

            if (actionName === 'generateStudyMaterials') {
              const topic = payload.topic || 'Concursos Públicos';
              const count = payload.count || 3;
              let allMaterials = [];

              for (let i = 0; i < count; i++) {
                const skeletonPrompt = `Você é o BizuBot. Gere o TÍTULO e uma BREVE INTRODUÇÃO para uma apostila de alto nível sobre "${topic}". 
                Responda APENAS JSON: { "title": "...", "intro": "..." }`;
                
                const skeletonRes = await callMistral(ai.mistral, skeletonPrompt, true, null, model);
                const skeleton = JSON.parse(extractJSON(skeletonRes.text));

                let fullContent = skeleton.intro + "\n\n";
                const parts = [
                  "Conceitos Fundamentais e Doutrina", 
                  "Desenvolvimento Técnico e Detalhamento", 
                  "Estratégias de Estudo (Ciclos e Memorização)",
                  "Estratégias de Prova (Bancas e Pegadinhas)",
                  "Bizus de Prova, Jurisprudência e Resumo Final"
                ];

                for (const part of parts) {
                  const contentPrompt = `Você é o Professor Especialista do Bizu. Escreva a parte de "${part}" para a apostila intitulada "${skeleton.title}".
                  FOCO: Máxima profundidade, estratégias práticas para o aluno e Markdown rico.
                  Retorne apenas o texto em Markdown.`;
                  
                  const contentRes = await callMistral(ai.mistral, contentPrompt, false, null, model);
                  fullContent += `## ${part}\n\n` + contentRes.text + "\n\n";
                  await sleep(1000);
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
              const batchSize = 5;
              const totalQuestions = Math.min(payload.numberOfQuestions, 100);
              let allQuestions = [];
              const numBatches = Math.ceil(totalQuestions / batchSize);

              for (let i = 0; i < numBatches; i++) {
                const currentBatchSize = Math.min(batchSize, totalQuestions - allQuestions.length);
                const batchPrompt = `Gere ${currentBatchSize} questões de nível "${payload.difficulty}" sobre "${payload.topic}".
                Responda APENAS JSON. Schema: [{id, text, options:[], correctAnswerIndex:number, explanation}]`;
                
                let success = false;
                let retryCount = 0;
                while (!success && retryCount < 3) {
                  try {
                    const res = await callMistral(ai.mistral, batchPrompt, true, null, model);
                    const batchQuestions = ensureArray(JSON.parse(extractJSON(res.text)));
                    allQuestions = [...allQuestions, ...batchQuestions];
                    success = true;
                    await sleep(1000);
                  } catch (err) {
                    retryCount++;
                    if (err.message.includes("RATE_LIMIT")) await sleep(2000);
                    else throw err;
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
              JSON Array: [{"title": "Título", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas", "summary": "Breve resumo"}]`;
              isJson = true;
            } else if (actionName === 'generateMaterialContent') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Professor de Elite e Autor de Materiais Didáticos (${isAcademico ? 'ENEM/Vestibular' : 'Concurso'}). 
              Gere uma APOSTILA completa, extremamente detalhada e profunda em Markdown para o tema: "${payload.material.title}".
              
              REQUISITOS:
              1. Teoria aprofundada com exemplos.
              2. Cálculos passo a passo (se aplicável).
              3. Blocos de destaque para "PONTOS IMPORTANTES" e "CAI EM PROVA".
              4. Mínimo de 5 exercícios com gabarito comentado.`;
            } else if (actionName === 'extendMaterialContent') {
              prompt = `Você é um Professor de Elite. O aluno já estudou sobre "${payload.material.title}" e quer CONTINUAR e APROFUNDAR.
              
              CONTEÚDO ANTERIOR: ${payload.currentContent.slice(-2000)}
              
              Gere a continuação inédita, sem repetir o que já foi dito. Use Markdown rico, traga detalhes técnicos e novos exercícios.`;
            } else if (actionName === 'generateRoutine') {
              prompt = `Crie um CRONOGRAMA DE ESTUDO semanal para: "${payload.targetExam}". Hours: ${payload.hours}. Subjects: ${payload.subjects}.
              Schema JSON: { "title": "...", "description": "...", "weekSchedule": [{ "day": "...", "tasks": [{"subject": "...", "duration": "...", "activity": "..."}] }] }`;
              isJson = true;
            } else if (actionName === 'createCustomMaterial') {
              prompt = `Você é um Especialista em Concursos. Crie um material estratégico sobre: "${payload.topic}".
              JSON Object: { "title": "...", "category": "...", "type": "PDF", "duration": "...", "summary": "..." }`;
              isJson = true;
            } else {
              prompt = "Processando ação..."; 
            }

            const res = await callMistral(ai.mistral, prompt, isJson, history, model);
            if (isJson) {
              const parsed = JSON.parse(extractJSON(res.text));
              return (actionName === 'generateQuiz' || actionName === 'generateMaterials' || actionName === 'updateRadar') 
                ? ensureArray(parsed) : parsed;
            }
            if (actionName === 'generateMaterialContent' || actionName === 'extendMaterialContent') {
               return { content: res.text };
            }
            return res;
          } catch (error) {
            console.warn(`⚠️ Mistral ${model} falhou: ${error.message}.`);
            continue;
          }
        }
      }

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
                const skeletonPrompt = `Você é o BizuBot. Gere o TÍTULO e uma BREVE INTRODUÇÃO para uma apostila de alto nível sobre "${topic}". 
                Responda APENAS JSON: { "title": "...", "intro": "..." }`;
                
                const skeletonRes = await callGroq(ai.groq, skeletonPrompt, true, null, model);
                const skeleton = JSON.parse(extractJSON(skeletonRes.text));

                let fullContent = skeleton.intro + "\n\n";
                const parts = [
                  "Conceitos Fundamentais e Doutrina", 
                  "Desenvolvimento Técnico e Detalhamento", 
                  "Estratégias de Estudo (Ciclos e Memorização)",
                  "Estratégias de Prova (Bancas e Pegadinhas)",
                  "Bizus de Prova, Jurisprudência e Resumo Final"
                ];

                for (const part of parts) {
                  const contentPrompt = `Você é o Professor Especialista do Bizu. Escreva a parte de "${part}" para a apostila intitulada "${skeleton.title}".
                  FOCO: Máxima profundidade, estratégias práticas para o aluno e Markdown rico.
                  Retorne apenas o texto em Markdown.`;
                  
                  const contentRes = await callGroq(ai.groq, contentPrompt, false, null, model);
                  fullContent += `## ${part}\n\n` + contentRes.text + "\n\n";
                  await sleep(2000); 
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
              const isAcademico = payload.studyType === 'academico';
              const batchSize = 5; 
              const totalQuestions = Math.min(payload.numberOfQuestions, 100);
              let allQuestions = [];
              const numBatches = Math.ceil(totalQuestions / batchSize);

              for (let i = 0; i < numBatches; i++) {
                const currentBatchSize = Math.min(batchSize, totalQuestions - allQuestions.length);
                if (currentBatchSize <= 0) break;

                const batchPrompt = `Gere ${currentBatchSize} questões (${isAcademico ? 'estilo ENEM/Vestibular' : 'estilo Concurso'}) de nível "${payload.difficulty}" sobre "${payload.topic}". 
                IMPORTANTE: NÃO gere questões sobre o exame em si. Gere questões sobre o CONTEÚDO que cai na prova (ex: se o tema for ENEM, escolha Biologia, História, etc).
                Responda APENAS JSON. Schema: [{id, text, options:[], correctAnswerIndex:number, explanation}]`;
                
                let success = false;
                let retryCount = 0;
                while (!success && retryCount < 3) {
                  try {
                    const res = await callGroq(ai.groq, batchPrompt, true, null, model);
                    const batchQuestions = ensureArray(JSON.parse(extractJSON(res.text)));
                    allQuestions = [...allQuestions, ...batchQuestions];
                    success = true;
                    if (numBatches > 1) await sleep(2000);
                  } catch (err) {
                    retryCount++;
                    if (err.message.includes("RATE_LIMIT") || err.message.includes("429")) {
                      console.log(`[Groq] Rate limit atingido. Esperando 5 segundos...`);
                      await sleep(5000);
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
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Especialista em ${isAcademico ? 'Educação (ENEM/Vestibular)' : 'Concursos'}. Liste ${payload.count} materiais.
              JSON Array: [{"title": "Título", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas", "summary": "Resumo"}]`;
              isJson = true;
            } else if (actionName === 'generateMaterialContent') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Professor de Elite e Autor de Materiais Didáticos (${isAcademico ? 'ENEM/Vestibular' : 'Concurso'}). 
              Gere uma APOSTILA completa, extremamente detalhada e profunda em Markdown para o tema: "${payload.material.title}".
              
              REQUISITOS:
              1. Teoria aprofundada com exemplos.
              2. Cálculos passo a passo (se aplicável).
              3. Blocos de destaque para "PONTOS IMPORTANTES" e "CAI EM PROVA".
              4. Mínimo de 5 exercícios com gabarito comentado.`;
            } else if (actionName === 'extendMaterialContent') {
              prompt = `Você é um Professor de Elite. O aluno já estudou sobre "${payload.material.title}" e quer CONTINUAR e APROFUNDAR.
              
              CONTEÚDO ANTERIOR: ${payload.currentContent.slice(-2000)}
              
              Gere a continuação inédita, sem repetir o que já foi dito. Use Markdown rico, traga detalhes técnicos e novos exercícios.`;
            } else if (actionName === 'generateRoutine') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Crie um CRONOGRAMA DE ESTUDO semanal para o perfil ${isAcademico ? 'ENEM/Vestibular' : 'Concurso'}: "${payload.targetExam}".
              Schema JSON: { "title": "...", "description": "...", "weekSchedule": [{ "day": "...", "tasks": [{"subject": "...", "duration": "...", "activity": "..."}] }] }`;
              isJson = true;
            } else if (actionName === 'updateRadar') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Liste 5 ${isAcademico ? 'Vestibulares/Exames' : 'concursos'} IMPORTANTES de 2026.
              JSON Array: [{"institution":"Nome","title":"Cargo/Prova","forecast":"Previsão","status":"Status","salary":"${isAcademico ? 'Inscrição' : 'R$'}","board":"Banca","url":""}]`;
              isJson = true;
            } else if (actionName === 'createCustomMaterial') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Especialista em ${isAcademico ? 'Educação' : 'Concursos'}. Crie um material estratégico sobre: "${payload.topic}".
              JSON Object: { "title": "...", "category": "...", "type": "PDF", "duration": "...", "summary": "..." }`;
              isJson = true;
            }
            
            const res = await callGroq(ai.groq, prompt, isJson, history, model);
            if (isJson) {
              const parsed = JSON.parse(extractJSON(res.text));
              return (actionName === 'generateQuiz' || actionName === 'generateMaterials' || actionName === 'updateRadar') 
                ? ensureArray(parsed) : parsed;
            }
            if (actionName === 'generateMaterialContent' || actionName === 'extendMaterialContent') {
               return { content: res.text };
            }
            return res;
          } catch (error) {
            console.warn(`⚠️ Groq ${model} falhou: ${error.message}.`);
            continue;
          }
        }
      }



      // --- TENTANDO OPENROUTER ---
      if (provider === 'openrouter' && ai.openRouter) {
        let models = [ai.openRouter.model, ...OPENROUTER_MODELS.filter(m => m !== ai.openRouter.model)];
        for (const model of models) {
          try {
            console.log(`[OpenRouter] Tentando ${actionName} com ${model}`);
            
            let prompt = "";
            let isJson = false;
            let history = null;

            if (actionName === 'generateQuiz') {
              const isAcademico = payload.studyType === 'academico';
              const batchSize = 10;
              const totalQuestions = Math.min(payload.numberOfQuestions, 100);
              let allQuestions = [];
              const numBatches = Math.ceil(totalQuestions / batchSize);

              for (let i = 0; i < numBatches; i++) {
                const currentBatchSize = Math.min(batchSize, totalQuestions - allQuestions.length);
                if (currentBatchSize <= 0) break;

                const batchPrompt = `Gere ${currentBatchSize} questões (${isAcademico ? 'estilo ENEM/Vestibular' : 'estilo Concurso'}) sobre "${payload.topic}" (${payload.difficulty}). 
                IMPORTANTE: NÃO gere questões sobre o exame em si. Gere questões sobre o CONTEÚDO que cai na prova (ex: se o tema for ENEM, escolha Biologia, História, etc).
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
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Especialista em ${isAcademico ? 'Educação (ENEM/Vestibular)' : 'Concursos'}. Liste ${payload.count} materiais.
              JSON Array: [{"title": "Título", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas", "summary": "Resumo"}]`;
              isJson = true;
            } else if (actionName === 'generateMaterialContent') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Professor de Elite e Autor de Materiais Didáticos (${isAcademico ? 'ENEM/Vestibular' : 'Concurso'}). 
              Gere uma APOSTILA completa, extremamente detalhada e profunda em Markdown para o tema: "${payload.material.title}".
              
              REQUISITOS:
              1. Teoria aprofundada com exemplos.
              2. Cálculos passo a passo (se aplicável).
              3. Blocos de destaque para "PONTOS IMPORTANTES" e "CAI EM PROVA".
              4. Mínimo de 5 exercícios com gabarito comentado.`;
            } else if (actionName === 'extendMaterialContent') {
              prompt = `Você é um Professor de Elite. O aluno já estudou sobre "${payload.material.title}" e quer CONTINUAR e APROFUNDAR.
              
              CONTEÚDO ANTERIOR: ${payload.currentContent.slice(-2000)}
              
              Gere a continuação inédita, sem repetir o que já foi dito. Use Markdown rico, traga detalhes técnicos e novos exercícios.`;
            } else if (actionName === 'generateRoutine') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Crie um CRONOGRAMA DE ESTUDO semanal para o perfil ${isAcademico ? 'ENEM/Vestibular' : 'Concurso'}: "${payload.targetExam}".
              Schema JSON: { "title": "...", "description": "...", "weekSchedule": [{ "day": "...", "tasks": [{"subject": "...", "duration": "...", "activity": "..."}] }] }`;
              isJson = true;
            } else if (actionName === 'updateRadar') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Liste 5 ${isAcademico ? 'Vestibulares/Exames' : 'concursos'} IMPORTANTES de 2026.
              JSON Array: [{"institution":"Nome","title":"Cargo/Prova","forecast":"Previsão","status":"Status","salary":"${isAcademico ? 'Inscrição' : 'R$'}","board":"Banca","url":""}]`;
              isJson = true;
            } else if (actionName === 'createCustomMaterial') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Especialista em ${isAcademico ? 'Educação' : 'Concursos'}. Crie um material estratégico sobre: "${payload.topic}".
              JSON Object: { "title": "...", "category": "...", "type": "PDF", "duration": "...", "summary": "..." }`;
              isJson = true;
            }

            const res = await callOpenRouter(ai.openRouter, prompt, isJson, history, model);
            if (isJson) {
              const parsed = JSON.parse(extractJSON(res.text));
              return (actionName === 'generateQuiz' || actionName === 'generateMaterials' || actionName === 'updateRadar') 
                ? ensureArray(parsed) : parsed;
            }
            if (actionName === 'generateMaterialContent' || actionName === 'extendMaterialContent') {
               return { content: res.text };
            }
            return res;
          } catch (error) {
            console.warn(`⚠️ OpenRouter ${model} falhou: ${error.message}.`);
            continue;
          }
        }
      }
    } catch (providerError) {
      console.error(`🚨 Falha crítica no provedor ${provider}:`, providerError.message);
      continue; // Próximo provedor se este falhar miseravelmente
    }
  }

  throw new Error("Todas as IAs e modelos (Gemini, Mistral, Groq e OpenRouter) atingiram o limite de uso.");
}

// --- AÇÕES ---

async function handleGenerateQuiz(genAI, modelName, { topic, difficulty, numberOfQuestions, studyType }) {
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
    Perfil de Estudo do Usuário: ${studyType === 'academico' ? 'ENEM / VESTIBULAR / ACADÊMICO' : 'CONCURSO PÚBLICO'}.
    ESTE É O LOTE ${i + 1} DE ${numBatches}.
    
    REQUISITOS CRÍTICOS:
    1. CONTEÚDO REAL: NÃO gere questões sobre "o que é o ENEM" ou "como funciona o concurso". Gere questões sobre o ASSUNTO (ex: se o tema for ENEM, gere questões de Biologia, História, Matemática, etc., que CAEM no ENEM).
    2. ESTILO DE PROVA: Utilize o perfil de estudo "${studyType === 'academico' ? 'ENEM / VESTIBULAR' : 'CONCURSO PÚBLICO'}" como base principal para o estilo do enunciado.
    3. PARA CONCURSOS: Use enunciados diretos, foco em lei seca, doutrina ou jurisprudência.
    4. PARA ENEM/VESTIBULAR: Use situações-problema, textos de apoio, interdisciplinaridade e foco em competências/habilidades.
    5. DISTRATORES FORTES: As alternativas incorretas devem ser plausíveis e baseadas em erros comuns.
    6. EXPLICAÇÃO PEDAGÓGICA: Explique detalhadamente no campo "explanation", justificando por que a correta é a certa e por que as outras estão erradas.
    
    Responda APENAS o JSON Array.
    Schema: [{"id": "uuid", "text": "enunciado", "options": ["A", "B", "C", "D", "E"], "correctAnswerIndex": 0, "explanation": "..."}]`;
    
    let success = false;
    while (!success) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const batchQuestions = ensureArray(JSON.parse(extractJSON(text)));
        allQuestions = [...allQuestions, ...batchQuestions];
        success = true; // Lote concluído com sucesso
      } catch (err) {
        // Se for erro de limite (429), espera 60s e tenta o MESMO lote novamente
        if (err.message.includes("429") || err.message.includes("Quota") || err.message.includes("exhausted")) {
          console.warn(`⚠️ Limite atingido no lote ${i + 1}. Aguardando 60s para tentar novamente este mesmo lote...`);
          await sleep(60000);
          // O loop 'while(!success)' fará a retentativa automática
        } else {
          // Para outros erros (segurança, sintaxe, etc), loga e tenta avançar ou falhar
          console.error(`Erro crítico no lote ${i + 1}:`, err.message);
          if (allQuestions.length > 0) {
            success = true; // Força saída deste lote para retornar o que já temos
            break; 
          }
          throw err;
        }
      }
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

async function handleGenerateMaterials(genAI, modelName, { count, studyType }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prompt = `Você é um Mentor de Estudos e Professor Especialista. Liste ${count} materiais de estudo de alta qualidade.
  Perfil de Estudo do Usuário: ${studyType === 'academico' ? 'ENEM / VESTIBULAR / ACADÊMICO' : 'CONCURSO PÚBLICO'}.
  
  Os materiais devem ser do tipo: "Apostila Completa" ou "Resumo Estratégico".
  Gere sugestões EXATAMENTE para o perfil acima.
  JSON Array: [{"title": "Título da Apostila", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas/Tempo", "summary": "Breve resumo técnico/estratégico do que será abordado"}]`;
  const result = await model.generateContent(prompt);
  return ensureArray(JSON.parse(extractJSON(result.response.text())));
}

async function handleGenerateMaterialContent(genAI, modelName, { material, studyType }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName, 
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4000,
    },
    safetySettings: SAFETY_SETTINGS 
  });

  const sections = [
    { 
      name: "Título e Introdução", 
      items: [
        "# [TÍTULO DA APOSTILA]", 
        "## 1. Introdução e Contextualização",
        "Apresente o tema de forma clara e sua importância absoluta para a aprovação. Liste os tópicos que serão abordados."
      ] 
    },
    { 
      name: "Desenvolvimento Teórico Parte 1", 
      items: [
        "## 2. Teoria Detalhada - Fundamentos",
        "Explique os conceitos base com máxima profundidade técnica. Use listas, negrito e tabelas Markdown para organizar a informação."
      ] 
    },
    { 
      name: "Desenvolvimento Teórico Parte 2", 
      items: [
        "## 3. Aprofundamento e Aplicações",
        "Traga detalhes avançados, exceções à regra, cálculos passo a passo (se o tema envolver matemática) e exemplos práticos reais."
      ] 
    },
    { 
      name: "Dicas e Estratégias", 
      items: [
        "## 4. Bizus, Macetes e Memorização",
        "Crie mnemônicos, dicas de 'ouro' para a hora da prova e como o tema costuma ser cobrado pelas bancas (pegadinhas comuns)."
      ] 
    },
    { 
      name: "Exercícios e Gabarito", 
      items: [
        "## 5. Exercícios de Fixação (Nível Médio/Difícil)",
        "Gere pelo menos 5 questões inéditas no estilo múltipla escolha (A, B, C, D, E) sobre o tema.",
        "## 6. Gabarito Comentado",
        "Forneça a resposta correta e explique POR QUE é a correta e por que as outras estão erradas."
      ] 
    }
  ];

  let fullContent = "";
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const prompt = `Você é um Professor de Elite e Autor de Materiais Didáticos para Concursos e Vestibulares. 
    Seu objetivo é produzir a MELHOR apostila do mercado sobre o tema: "${material.title}".
    
    Perfil de Estudo do Usuário: ${studyType === 'academico' ? 'ENEM / VESTIBULAR / ACADÊMICO' : 'CONCURSO PÚBLICO'}.
    
    ESTA PARTE DEVE CONTER:
    ${section.items.join("\n")}
    
    DIRETRIZES DE QUALIDADE:
    1. DETALHAMENTO: Não seja superficial. Explique o "porquê" das coisas.
    2. CÁLCULOS: Se o tema envolver matemática/exatas, apresente o cálculo passo a passo, detalhando cada etapa da resolução.
    3. FORMATAÇÃO: Use Markdown rico. Tabelas para comparações, negrito para termos chave, e citações para definições importantes.
    4. FOCO NO PERFIL:
       - CONCURSOS: Cite leis, artigos e jurisprudência (STF/STJ) se aplicável. Use tom técnico.
       - ENEM/VESTIBULAR: Use linguagem didática, interdisciplinar e focada em resolução de problemas.
    5. CONTINUIDADE: Mantenha o fluxo de escrita natural em relação às partes anteriores.
    
    CONTEÚDO JÁ GERADO (PARA CONTEXTO):
    ${fullContent.slice(-2000)} ...`;

    try {
      console.log(`[Material] Gerando ${section.name}...`);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      fullContent += "\n\n" + text;
      
      // Como o usuário pediu para "gerar um pouco e esperar", vamos aguardar um pouco entre as partes
      // mas apenas se houver mais partes a serem geradas.
      if (i < sections.length - 1) {
         console.log(`[Material] Parte ${i+1} concluída. Aguardando reset de limite (2s)...`);
         await sleep(2000); // Reduzido de 60s para 2s para evitar timeout
       }
    } catch (err) {
      if (err.message.includes("429") || err.message.includes("Quota")) {
        console.warn(`⚠️ Limite atingido na geração do material. Aguardando 60s para continuar...`);
        await sleep(60000);
        i--; // Tenta a mesma seção novamente
        continue;
      }
      throw err;
    }
  }

  return { content: fullContent.trim() };
}

async function handleGenerateRoutine(genAI, modelName, { targetExam, hours, subjects, studyType }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName, 
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prioritySubjects = parseSubjectList(subjects);
  const minDistinct = Math.max(5, Math.min(10, prioritySubjects.length + 3));

  const prompt = `Você é um Mentor de Estudos especialista em Ciclos de Estudo e Produtividade.
  Crie um CRONOGRAMA DE ESTUDO semanal completo para o objetivo: "${targetExam}".
  Perfil de Estudo: ${studyType === 'academico' ? 'ENEM / VESTIBULAR / ACADÊMICO' : 'CONCURSO PÚBLICO'}.
  Disponibilidade: ${hours} horas por dia.
  Matérias prioritárias (dar mais tempo e mais recorrência): ${Array.isArray(subjects) ? subjects.join(", ") : subjects}.
  
  REGRA DE OURO: a lista acima NÃO é a lista completa do que deve ser estudado. Identifique se o objetivo é um CONCURSO ou ENEM/VESTIBULAR e complete com matérias essenciais.
  - Para CONCURSOS: Foque em Direito, Português, Raciocínio Lógico, etc., dependendo do cargo.
  - Para ENEM/VESTIBULAR: Foque em Matemática, Linguagens (Gramática, Literatura, Interpretação), Ciências da Natureza (Biologia, Química, Física), Ciências Humanas (História, Geografia, Filosofia, Sociologia) e Redação (mínimo 1x por semana).
  
  Distribua a semana em ciclo, com a(s) matéria(s) prioritária(s) aparecendo(em) mais vezes, sem excluir as demais.
  MÍNIMO: inclua pelo menos ${minDistinct} matérias distintas ao longo da semana.
  
  REGRAS CRÍTICAS DE TEMPO E PROPORÇÃO:
  1. QUESTÕES: Cada questão deve levar em média 1.5 a 2 minutos.
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

async function handleUpdateRadar(genAI, modelName, { existingTitles: titlesArray, studyType }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const today = new Date().toLocaleDateString('pt-BR');
  const existingTitles = Array.isArray(titlesArray) ? titlesArray.join(", ") : "Nenhum";

  const isAcademico = studyType === 'academico';

  const prompt = `Você é um Analista de ${isAcademico ? 'Exames Acadêmicos (ENEM e Vestibulares)' : 'Concursos Públicos'}. Hoje é dia ${today}.
  Sua tarefa é listar os 5 ${isAcademico ? 'exames (ENEM, Vestibulares de Medicina/Federais)' : 'concursos'} mais importantes e recentes (previstos ou com edital aberto) para o ano de 2026 no Brasil.
  
  REGRAS CRÍTICAS:
  1. FOCO TEMPORAL: Apenas ${isAcademico ? 'provas/inscrições' : 'concursos'} que ocorrerão ou terão edital a partir de hoje (${today}).
  2. NOVIDADE: NÃO inclua nenhum destes que já estão na lista: [${existingTitles}].
  3. SE NÃO HOUVER NOVIDADES: Se todos os itens relevantes de 2026 já estiverem na lista acima e não houver NADA de novo ou mais importante para adicionar, responda APENAS: {"no_updates": true}.
  4. FORMATO: Se houver novidades, responda um JSON Array com exatamente 5 itens.
  
  Schema (se houver novidade): [{"institution":"Nome da Instituição/Faculdade","title":"Cargo ou Nome da Prova","forecast":"Previsão da Prova/Edital","status":"Inscrições Abertas/Previsto/Edital Publicado","salary":"${isAcademico ? 'Valor da Inscrição' : 'R$ Inicial'}","board":"Banca Organizadora","url":""}]
  Schema (se NÃO houver novidade): {"no_updates": true}`;

  const result = await model.generateContent(prompt);
  const text = extractJSON(result.response.text());
  const parsed = JSON.parse(text);

  if (parsed.no_updates) {
    return { no_updates: true };
  }

  return ensureArray(parsed);
}

async function handleCreateCustomMaterial(genAI, modelName, { topic, studyType }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: SAFETY_SETTINGS
  });

  const prompt = `Você é um Especialista em Educação e Mentor de Estudos.
  Perfil de Estudo: ${studyType === 'academico' ? 'ENEM / VESTIBULAR / ACADÊMICO' : 'CONCURSO PÚBLICO'}.
  Crie um material de estudo estratégico baseado no seguinte tema: "${topic}".
  
  JSON Object: {
    "title": "Título Profissional e Específico",
    "category": "Disciplina (ex: Português, Direito Administrativo, Biologia, etc)",
    "type": "PDF",
    "duration": "Tempo estimado de estudo ou páginas",
    "summary": "Breve resumo técnico/estratégico do que será abordado na apostila completa"
  }`;
  
  const result = await model.generateContent(prompt);
  return JSON.parse(extractJSON(result.response.text()));
}

async function handleExtendMaterialContent(genAI, modelName, { material, currentContent, studyType }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName, 
    systemInstruction: BIZU_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4000,
    },
    safetySettings: SAFETY_SETTINGS 
  });

  const prompt = `Você é um Professor de Elite e Autor de Materiais Didáticos. 
  O aluno já estudou a parte inicial da apostila sobre "${material.title}" e agora quer APROFUNDAR ainda mais.
  
  Sua tarefa é gerar a PRÓXIMA PARTE da apostila, trazendo conteúdos que ainda não foram abordados ou detalhando pontos complexos que merecem mais atenção.
  
  DIRETRIZES DE OURO:
  1. CONTINUIDADE: Comece de onde o conteúdo anterior parou. Não repita introduções.
  2. PROFUNDIDADE MÁXIMA: Traga detalhes técnicos, casos práticos, cálculos complexos passo a passo e doutrina/jurisprudência avançada.
  3. DESTAQUES: Use blocos de citação (blockquote) ou tabelas para destacar "PONTOS IMPORTANTES" e "CAI EM PROVA".
  4. EXERCÍCIOS: Se for o caso, adicione mais uma bateria de exercícios de nível difícil com gabarito comentado.
  5. FORMATO: Use Markdown rico.
  
  CONTEÚDO JÁ EXISTENTE (PARA VOCÊ SABER O QUE NÃO REPETIR):
  ${currentContent.slice(-3000)} ...`;

  try {
    console.log(`[Material] Estendendo conteúdo para "${material.title}"...`);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return { content: text };
  } catch (err) {
    console.error("Erro ao estender material:", err.message);
    throw err;
  }
}

async function handleGenerateStudyMaterials(genAI, modelName, { topic, count }) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    safetySettings: SAFETY_SETTINGS
  });

  const numMaterials = count || 3;
  let allMaterials = [];

  for (let i = 0; i < numMaterials; i++) {
    try {
      console.log(`[StudyMaterials] Gerando material ${i + 1} de ${numMaterials} para "${topic}"...`);
      
      const skeletonPrompt = `Você é o BizuBot. Gere o TÍTULO e uma BREVE INTRODUÇÃO para uma apostila de alto nível sobre "${topic}". 
      Responda APENAS JSON: { "title": "...", "intro": "..." }`;
      
      const skeletonResult = await model.generateContent(skeletonPrompt);
      const skeleton = JSON.parse(extractJSON(skeletonResult.response.text()));

      // Usamos o handleGenerateMaterialContent para gerar o conteúdo completo com chunking e waits
      const contentResult = await handleGenerateMaterialContent(genAI, modelName, { material: skeleton });
      
      allMaterials.push({
        id: Date.now() + i,
        title: skeleton.title,
        content: contentResult.content,
        category: topic,
        timestamp: new Date()
      });

    } catch (err) {
      console.error(`Erro ao gerar material ${i + 1}:`, err.message);
      if (err.message.includes("429") || err.message.includes("Quota")) {
        console.warn("Limite atingido. Aguardando 60s...");
        await sleep(60000);
        i--; // Tenta o mesmo material novamente
        continue;
      }
      // Se for outro erro, apenas ignora este material e tenta o próximo
    }
  }

  return allMaterials;
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
