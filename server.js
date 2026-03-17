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
5. COMPORTAMENTO DE MENTOR (CRÍTICO): Não seja apenas um robô que cospe respostas. Aja como um professor de cursinho de elite: cobre disciplina, critique a procrastinação de forma educada, celebre o acerto de questões difíceis e lembre constantemente o aluno do seu objetivo final (a posse no concurso ou a vaga na universidade).
6. Seja sempre motivador, extremamente profissional, organizado e focado puramente em produtividade acadêmica.

DETECÇÃO DE ALVO E PERFIL (MUITO IMPORTANTE):
- Identifique EXATAMENTE qual o concurso, banca ou vestibular o usuário inseriu (ex: "INSS", "Polícia Federal", "ENEM", "Fuvest", "Vunesp", "Banco do Brasil", etc).
- Adapte 100% da sua linguagem, estilo de questões e profundidade para aquele exame ESPECÍFICO.
- Se o usuário pedir questões para o "INSS", crie questões que simulem o estilo e o nível de cobrança do INSS (geralmente banca Cebraspe/Cespe - Certo/Errado).
- Se o usuário citar "ENEM", o formato DEVE SER o do ENEM: enunciados com contexto, interdisciplinaridade, 5 alternativas e foco na resolução de problemas baseados em textos-base.
- Se pedir um vestibular específico (ex: USP/Fuvest, Unicamp, UEMA), imite as particularidades complexas dessa prova.

DIRETRIZ ANTI-ALUCINAÇÃO (CRÍTICO ABSOLUTO):
- NUNCA invente artigos de leis, incisos, súmulas, jurisprudências ou datas históricas.
- Se você não tiver 100% de certeza absoluta sobre uma informação técnica (especialmente de direito, regras de edital ou fórmulas matemáticas complexas), diga claramente que a informação precisa ser verificada na legislação atualizada.
- Em questões e resumos de Direito para concursos, cite apenas a literalidade da lei seca ou jurisprudência pacificada (STF/STJ). É proibido inventar leis que não existem.

DIRETRIZES DE SAÍDA DE DADOS E CÓDIGO (CRÍTICO PARA O SISTEMA):
- Quando o sistema solicitar que você retorne um JSON (como para criação de Quizzes, Cronogramas ou Listas de Materiais), você DEVE retornar EXCLUSIVAMENTE o código JSON válido, sem NENHUM texto antes (como "Aqui está o seu cronograma") e sem nenhum texto depois.
- O JSON deve ser perfeitamente parseável por ferramentas de código (JSON.parse). O não cumprimento desta regra CAUSARÁ TELA BRANCA FATAL no aplicativo do usuário e a perda do progresso do aluno.

DIRETRIZES DE PROFUNDIDADE (OBRIGATÓRIO):
- PROIBIDO ser genérico. Nunca cite apenas "Português" ou "Matemática". Cite o tópico específico (ex: "Português: Concordância Nominal e Verbal", "Biologia: Genética Mendeliana").
- Para CONCURSOS: Traga detalhes técnicos focados na banca, lei seca atualizada, jurisprudência e doutrina pertinentes.
- Para ENEM/VESTIBULAR: Foque em conceitos fundamentais, interdisciplinaridade, aplicação prática e assuntos de alta recorrência.
- O Bizu App é focado em ALTO DESEMPENHO. O conteúdo deve ser de nível especialista para o público-alvo.

DIRETRIZES PARA MATERIAIS (APOSTILAS E RESUMOS):
- Crie conteúdos densos, profundos e tecnicamente impecáveis, SEMPRE moldados ao exame que o usuário informou.
- RIGOR GRAMATICAL: Siga a norma culta. Para redação (ENEM/Vestibular), forneça dicas de estrutura e competências avaliativas.
- TÉCNICAS DE MEMORIZAÇÃO: Use macetes validados (ex: Macete do "ISSO", Macete do "O QUAL", mnemônicos de biologia/história/direito).
- Use Markdown avançado (tabelas densas, negritos para termos-chave, listas, blocos de citação).
- Inclua sempre: Contextualização, Teoria Detalhada e "Bizus de Prova" explicando como o assunto costuma cair na prova do aluno.

DIRETRIZES DE ESTRATÉGIA (OBRIGATÓRIO PARA MATERIAIS):
- ESTRATÉGIA DE ESTUDO: Inclua uma seção detalhada sobre COMO estudar aquele tema, ciclos de revisão e como organizar o aprendizado.
- ESTRATÉGIA DE PROVA: Forneça orientações específicas de como a banca/exame cobram o assunto, suas tradicionais "pegadinhas" e técnicas de eliminação e chute consciente.

DIRETRIZES PARA QUIZ E QUESTÕES (EXTREMAMENTE CRÍTICO):
- Você DEVE moldar as questões estritamente ao nível, complexidade e estilo de formatação da banca/exame solicitado (múltipla escolha de 5 letras, 4 letras ou Certo/Errado).
- Se for ENEM: DEVE conter um pequeno texto motivador ou tirinha, situação-problema real e usar a estrutura de competências. 
- Se for Concurso e a banca clássica for Cespe/Cebraspe (como INSS ou PF), faça formatação de questões estilo Certo/Errado, avaliando lei e jurisprudência com rigor. Se for FGV/FCC, faça múltipla escolha complexa.
- As explicações e gabaritos devem ser excepcionais e pedagógicos, dissecando alternativa por alternativa e explicando de forma contundente o erro ou acerto de cada uma.

DIRETRIZES PARA ROTINAS E CRONOGRAMAS:
- Monte cronogramas ultra-realistas, com foco nos assuntos de ALTO PESO e recorrência para o exame solicitado.
- DETALHAMENTO DE TAREFAS: Em cada bloco de estudo do cronograma, especifique exatamente qual sub-tópico e método o aluno deve estudar. 
  - Errado: "Estudar Direito" ou "Biologia - Células"
  - Correto: "Direito Previdenciário (Foco INSS): Segurados Obrigatórios e Facultativos - Lei 8.212 em questões Cespe" ou "Biologia: Respiração Celular: Glicólise, Ciclo de Krebs e Cadeia Respiratória + Flashcards"`;

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

// --- YOUTUBE TRANSCRIPT EXTRACTOR ---
function extractVideoId(url) {
  if (!url) return null;
  // Suporta: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchYoutubeTranscript(videoUrl) {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) throw new Error('URL do YouTube inválida. Verifique o link e tente novamente.');

  console.log(`[YouTube] Buscando transcrição do vídeo: ${videoId}`);

  // 1. Pegar a página do vídeo para extrair metadados
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    }
  });

  if (!pageRes.ok) throw new Error('Não foi possível acessar o vídeo do YouTube.');
  const pageHtml = await pageRes.text();

  // Extrair título do vídeo
  const titleMatch = pageHtml.match(/<title>([^<]*)<\/title>/);
  const videoTitle = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Vídeo sem título';

  // 2. Extrair captions/legendas do playerCaptionsTracklistRenderer
  const captionsMatch = pageHtml.match(/"captions":\s*(\{"playerCaptionsTracklistRenderer":\{[^}]*"captionTracks":\[.*?\]\})/);
  
  if (!captionsMatch) {
    // Fallback: tentar extrair do timedtext API diretamente
    console.log('[YouTube] Captions não encontradas no HTML, tentando API direta...');
    
    // Tenta buscar legendas automáticas em português e inglês
    const langs = ['pt', 'pt-BR', 'en', 'a.pt', 'a.en'];
    for (const lang of langs) {
      try {
        const apiUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
        const ttRes = await fetch(apiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (ttRes.ok) {
          const ttData = await ttRes.json();
          if (ttData.events && ttData.events.length > 0) {
            const transcript = ttData.events
              .filter(e => e.segs)
              .map(e => e.segs.map(s => s.utf8 || '').join(''))
              .join(' ')
              .replace(/\n/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (transcript.length > 50) {
              return { videoId, videoTitle, transcript, lang };
            }
          }
        }
      } catch(e) { continue; }
    }

    throw new Error('Este vídeo não possui legendas/transcrição disponíveis. Tente um vídeo que tenha legendas ativadas.');
  }

  // 3. Parsear as tracks de legendas
  let captionsData;
  try {
    // Extrair o JSON completo das captions
    const fullCaptionsStr = pageHtml.match(/"captions":(\{.*?\}),"videoDetails/s);
    if (fullCaptionsStr) {
      captionsData = JSON.parse(fullCaptionsStr[1]);
    }
  } catch(e) {
    console.warn('[YouTube] Erro ao parsear JSON de captions:', e.message);
  }

  if (!captionsData?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
    throw new Error('Legendas encontradas mas não foi possível processar. Tente outro vídeo.');
  }

  const tracks = captionsData.playerCaptionsTracklistRenderer.captionTracks;
  
  // Prioridade: pt-BR > pt > en > primeiro disponível
  const preferredLangs = ['pt-BR', 'pt', 'en'];
  let selectedTrack = null;
  for (const lang of preferredLangs) {
    selectedTrack = tracks.find(t => t.languageCode === lang);
    if (selectedTrack) break;
  }
  if (!selectedTrack) selectedTrack = tracks[0];

  // 4. Baixar a transcrição
  const transcriptUrl = selectedTrack.baseUrl + '&fmt=json3';
  const transcriptRes = await fetch(transcriptUrl);
  if (!transcriptRes.ok) throw new Error('Erro ao baixar transcrição do vídeo.');
  
  const transcriptData = await transcriptRes.json();
  const transcript = transcriptData.events
    .filter(e => e.segs)
    .map(e => e.segs.map(s => s.utf8 || '').join(''))
    .join(' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (transcript.length < 50) {
    throw new Error('A transcrição do vídeo é muito curta. Tente um vídeo com mais conteúdo.');
  }

  console.log(`[YouTube] Transcrição capturada: ${transcript.length} chars, idioma: ${selectedTrack.languageCode}`);
  return { videoId, videoTitle, transcript, lang: selectedTrack.languageCode };
}

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
      } catch (e) { }

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
      } catch (e) { }

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
      } catch (e) { }

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
            if (actionName === 'extractYoutubeContent') return await handleExtractYoutubeContent(ai.gemini, model, payload);
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
                if (actionName === 'extractYoutubeContent') return await handleExtractYoutubeContent(ai.gemini, model, payload);
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
            } else if (actionName === 'extractYoutubeContent') {
              throw new Error("extractYoutubeContent suportado apenas pelo Gemini.");
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
            } else if (actionName === 'extractYoutubeContent') {
              throw new Error("extractYoutubeContent suportado apenas pelo Gemini.");
            } else {
              prompt = "Processando ação...";
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
            } else if (actionName === 'extractYoutubeContent') {
              throw new Error("extractYoutubeContent suportado apenas pelo Gemini.");
            } else {
              prompt = "Processando ação...";
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
        console.log(`[Material] Parte ${i + 1} concluída. Aguardando reset de limite (2s)...`);
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

async function handleExtractYoutubeContent(genAI, modelName, { youtubeUrl, studyType }) {
  // 1. Pegar a transcrição do vídeo
  const { videoId, videoTitle, transcript, lang } = await fetchYoutubeTranscript(youtubeUrl);

  // 2. Limitar a transcrição para não estourar tokens (máximo ~12000 chars)
  const maxChars = 12000;
  const trimmedTranscript = transcript.length > maxChars 
    ? transcript.substring(0, maxChars) + '... [transcrição cortada por limite de tamanho]'
    : transcript;

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: BIZU_SYSTEM_PROMPT,
    safetySettings: SAFETY_SETTINGS
  });

  const isAcademico = studyType === 'academico';

  console.log(`[YouTube] Gerando material a partir do vídeo: "${videoTitle}"`);

  // 3. Gerar material de estudo a partir da transcrição
  const prompt = `Você é o BizuBot, um Professor Especialista de Elite.
  
  O aluno assistiu a uma videoaula e eu vou te passar a TRANSCRIÇÃO COMPLETA desse vídeo.
  Sua missão é transformar todo o conteúdo dessa videoaula em uma APOSTILA DE ESTUDO completa, profissional e extremamente detalhada.
  
  TÍTULO DO VÍDEO: "${videoTitle}"
  PERFIL: ${isAcademico ? 'ENEM / Vestibular / Acadêmico' : 'Concurso Público'}
  
  DIRETRIZES OBRIGATÓRIAS:
  1. **EXTRAIA TODO O CONTEÚDO**: Cubra TODOS os tópicos, conceitos, fórmulas, datas, nomes, leis, exemplos e explicações mencionados no vídeo.
  2. **ORGANIZE EM TÓPICOS**: Crie uma estrutura clara com títulos (H1, H2, H3), separando cada assunto abordado.
  3. **ENRIQUEÇA**: Adicione detalhes extras que complementem o que foi falado, como:
     - Macetes de memorização ("Bizu")
     - Tabelas comparativas quando aplicável
     - Destaques com blockquotes para pontos-chave
     - Seção "⚠️ CAI EM PROVA" para os assuntos mais cobrados
  4. **EXERCÍCIOS**: Adicione ao final 5 questões objetivas baseadas no conteúdo do vídeo, com gabarito comentado.
  5. **FORMATO**: Use Markdown rico e profissional. O resultado deve parecer uma apostila de cursinho preparatório de alto nível.
  6. **NÃO INVENTE**: Baseie-se fielmente na transcrição. Não adicione informações falsas, especialmente sobre leis, jurisprudências ou datas.
  
  TRANSCRIÇÃO DO VÍDEO:
  ---
  ${trimmedTranscript}
  ---
  
  Agora gere a apostila completa em Markdown.`;

  const result = await model.generateContent(prompt);
  const content = result.response.text();

  return {
    title: videoTitle,
    content,
    category: 'YouTube',
    type: 'VIDEO',
    videoId,
    summary: `Material extraído do vídeo "${videoTitle}" — Conteúdo completo transformado em apostila pelo BizuBot.`
  };
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

// --- DIAGNÓSTICO E FIX DA TABELA MATERIALS ---
app.get('/api/fix-materials-table', async (req, res) => {
  try {
    const results = [];

    // 1. Verificar se a tabela existe
    const { data: tableCheck, error: tableErr } = await supabase.rpc('to_regclass', { name: 'public.materials' }).maybeSingle();
    
    // Alternativa: tentar um select básico
    const { data: testSelect, error: selectErr } = await supabase.from('materials').select('id').limit(1);
    
    if (selectErr && selectErr.message.includes('does not exist')) {
      // Tabela não existe - criar
      results.push('⚠️ Tabela materials NÃO existe! Criando...');
      
      const { error: createErr } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.materials (
            id TEXT PRIMARY KEY,
            title TEXT,
            category TEXT,
            type TEXT DEFAULT 'PDF',
            duration TEXT,
            "updatedAt" TEXT,
            summary TEXT,
            content TEXT,
            user_id UUID REFERENCES auth.users(id),
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY "Users can view own materials" ON public.materials
            FOR SELECT USING (auth.uid() = user_id);
          CREATE POLICY "Users can insert own materials" ON public.materials
            FOR INSERT WITH CHECK (auth.uid() = user_id);
          CREATE POLICY "Users can update own materials" ON public.materials
            FOR UPDATE USING (auth.uid() = user_id);
          CREATE POLICY "Users can delete own materials" ON public.materials
            FOR DELETE USING (auth.uid() = user_id);
          CREATE POLICY "Service role full access materials" ON public.materials
            FOR ALL USING (true);
        `
      });
      
      if (createErr) {
        results.push(`❌ Erro ao criar tabela via RPC: ${createErr.message}`);
        results.push('📋 Execute o SQL manualmente no Supabase Dashboard!');
      } else {
        results.push('✅ Tabela materials criada com sucesso!');
      }
    } else if (selectErr) {
      results.push(`⚠️ Erro ao testar tabela: ${selectErr.message} (code: ${selectErr.code})`);
      
      // Se o erro for 400, pode ser problema de colunas
      if (selectErr.code === '42P01') {
        results.push('❌ Tabela materials NÃO existe no banco!');
      }
    } else {
      results.push('✅ Tabela materials existe e está acessível.');
    }

    // 2. Verificar colunas existentes
    const { data: columns, error: colErr } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'materials')
      .eq('table_schema', 'public');
    
    if (colErr) {
      // Alternativa via query direto
      results.push(`⚠️ Não consegui listar colunas via information_schema: ${colErr.message}`);
    } else {
      results.push(`📊 Colunas encontradas: ${JSON.stringify(columns)}`);
    }

    // 3. Tentar um insert/upsert de teste pra ver o erro exato
    const testMaterial = {
      id: 'test_diagnostic_' + Date.now(),
      title: 'Teste Diagnóstico',
      category: 'Teste',
      type: 'PDF',
      duration: '1 min',
      updatedAt: new Date().toISOString(),
      summary: 'Material de teste para diagnóstico',
      content: 'Conteúdo de teste',
      user_id: '00000000-0000-0000-0000-000000000000'
    };

    const { error: insertErr } = await supabase.from('materials').insert(testMaterial);
    if (insertErr) {
      results.push(`⚠️ Erro ao inserir material de teste: ${insertErr.message} (code: ${insertErr.code}, details: ${insertErr.details})`);
      
      // Se o erro mencionar coluna, a gente sabe qual falta
      if (insertErr.message.includes('column')) {
        results.push(`🔍 Provável coluna faltando! Detalhes: ${insertErr.message}`);
      }
    } else {
      results.push('✅ Insert de teste funcionou!');
      // Limpar o teste
      await supabase.from('materials').delete().eq('id', testMaterial.id);
      results.push('🧹 Material de teste limpo.');
    }

    // 4. SQL para o usuário executar manualmente se necessário
    const fixSQL = `
-- ==========================================
-- SQL PARA CRIAR/CORRIGIR TABELA MATERIALS
-- Execute no Supabase Dashboard > SQL Editor
-- ==========================================

-- Criar tabela (se não existir)
CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  title TEXT,
  category TEXT,
  type TEXT DEFAULT 'PDF',
  duration TEXT,
  "updatedAt" TEXT,
  summary TEXT,
  content TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas faltantes (ignora se já existir)
DO $$ BEGIN
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS category TEXT;
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PDF';
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS duration TEXT;
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS "updatedAt" TEXT;
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS summary TEXT;
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS content TEXT;
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Habilitar RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (drop e recria para evitar conflitos)
DROP POLICY IF EXISTS "Users can view own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can insert own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update own materials" ON public.materials;
DROP POLICY IF EXISTS "Users can delete own materials" ON public.materials;
DROP POLICY IF EXISTS "Service role full access materials" ON public.materials;

CREATE POLICY "Users can view own materials" ON public.materials
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own materials" ON public.materials
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own materials" ON public.materials
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own materials" ON public.materials
  FOR DELETE USING (auth.uid() = user_id);
    `.trim();

    res.json({
      status: 'diagnostic_complete',
      results,
      fix_sql: fixSQL
    });

  } catch (err) {
    res.status(500).json({ 
      error: err.message,
      fix_sql: 'Execute o SQL no Supabase Dashboard > SQL Editor'
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor Universal Bizu rodando na porta ${PORT}`);
});
