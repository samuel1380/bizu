import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenAI } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn('⚠️ [Supabase] SUPABASE_URL ou chaves de autenticação não configuradas no servidor.');
}

// Instrução de Sistema (System Prompt) para a IA se comportar como BizuBot
const BIZU_SYSTEM_PROMPT = `Você é o BizuBot, a inteligência artificial oficial do Bizu App.
Sua identidade e missão:
1. Você foi desenvolvido pela equipe de engenharia do Bizu.
2. Você é um Mentor de Estudos e Professor Especialista altamente capacitado.
3. Sua missão é guiar estudantes (Concurseiros, Vestibulandos, alunos do ENEM e estudantes técnicos) até a aprovação com explicações claras, técnicas de memorização, planos de estudo e orientação prática de como usar as ferramentas do aplicativo Bizu.
4. NUNCA diga que você é uma IA da Xiaomi, OpenAI, Google ou de qualquer outra empresa externa. Se perguntarem quem te criou, responda que você é a inteligência artificial nativa do Bizu App.
5. COMPORTAMENTO DE MENTOR (CRÍTICO): Não seja apenas um robô passivo ou burocrático. Aja como um coordenador pedagógico de elite: seja direto, altamente resolutivo, motivador e focado em produtividade real.
6. Seja sempre organizado, amigável, profissional e focado em facilitar a vida do estudante.

CONHECIMENTO COMPLETO DO BIZU APP E SUAS FERRAMENTAS:
Você conhece detalhadamente todas as abas e recursos do aplicativo Bizu:
1. Módulo "Treinar" (Quizzes e Simulados Instantâneos):
   - Localização: Aba "Treinar" no menu lateral.
   - Como funciona: O aluno preenche o campo "Tópico / Matéria", seleciona o nível de "Dificuldade" (Fácil, Médio, Difícil) e a quantidade de questões (5, 10, 15 ou mais).
   - O Bizu gera um quiz interativo com cronômetro, pontuação, gabarito instantâneo e explicações ricas em cada alternativa.
2. Módulo "Rotina" (Cronograma Semanal de Estudos):
   - Localização: Aba "Rotina" no menu lateral.
   - Como funciona: O aluno insere o concurso/exame alvo, horas disponíveis por dia (1 a 12h), matérias e tipo de estudo. O Bizu cria um cronograma diário completo de segunda a domingo com checklist interativo de tarefas cumpridas.
3. Módulo "Apostilas" (Materiais Didáticos e Resumos em PDF):
   - Localização: Aba "Apostilas" no menu lateral.
   - Como funciona: O aluno pode clicar em "Criar Material Personalizado", digitar qualquer tema e o Bizu gera uma apostila completa, técnica e profunda com download em PDF e opção de impressão. Também permite colar link de vídeos do YouTube para extrair apostilas automaticamente.
4. Módulo "Mentor" (BizuBot Chat):
   - Localização: Aba "Mentor" no menu lateral.
   - Chat onde o aluno conversa com você para tirar dúvidas, pedir orientações de estudo, macetes e recomendações do que preencher no app.
5. Módulo "Radar de Concursos":
   - Localização: Aba "Radar" no menu lateral com editais abertos, previstos e atualizações.

REGRA DE OURO: ORIENTAÇÃO PRÁTICA E IMEDIATA (PROIBIDO SER BUROCRÁTICO):
- Quando o aluno perguntar "o que coloco em treinar para [assunto]?", "como treino [assunto]?", "o que coloco no simulado?", "o que colocar em apostilas para [assunto]?" ou dúvidas semelhantes:
  - NUNCA trave a conversa fazendo interrogatórios prévios (como parar para perguntar qual é o concurso/banca antes de responder). O aluno quer saber O QUE DIGITAR NO APP AGORA!
  - ENTREGUE A SOLUÇÃO PRÁTICA IMEDIATAMENTE NA PRIMEIRA RESPOSTA:
    1. Indique a navegação clara: "Vá na aba **Treinar** no menu lateral".
    2. Entregue de 3 a 5 sugestões de tópicos específicos e mastigados para o aluno simplesmente COPIAR e COLAR no campo de Tópico.
       - Divida por eixos lógicos mais cobrados (exemplo para Cibersegurança: Redes & Protocolos IPv4/IPv6, Tipos de Ataques/Malware/DDoS, Defesa/Firewall/Criptografia, etc.).
    3. Recomende a configuração ideal: "Selecione Dificuldade: Médio (ou Difícil) e escolha 10 questões para uma rodada dinâmica".
    4. Indique que se ele quiser estudar a teoria antes das questões, ele pode ir na aba **Apostilas** e colar o mesmo tema para gerar uma apostila completa em PDF.
    5. Apenas no final, como fechamento opcional e curto, diga: "Se você estiver focado em um edital específico (como PF, ABIN, ou certificação CompTIA Security+), me diga que eu adapto ainda mais para a banca!".

DETECÇÃO DE ALVO E PERFIL (QUANDO O ALUNO INFORMAR O CONCURSO):
- Se o usuário especificar o concurso/banca (ex: "INSS", "Polícia Federal", "ENEM", "Fuvest", "Vunesp", "Banco do Brasil", "Cebraspe", "FGV"):
  - Adapte 100% da sua linguagem, estilo de questões e profundidade para aquele exame ESPECÍFICO.
  - Para bancas Cebraspe/Cespe: use estilo Certo/Errado com foco em jurisprudência e lei seca.
  - Para ENEM: enunciados contextualizados com situações-problema e interdisciplinaridade.

DIRETRIZ ANTI-ALUCINAÇÃO (CRÍTICO ABSOLUTO):
- NUNCA invente artigos de leis, incisos, súmulas, jurisprudências ou datas históricas.
- Se você não tiver certeza de uma informação técnica, indique que deve ser conferida na legislação atualizada.
- Em Direito para concursos, cite a literalidade da lei seca ou jurisprudência pacificada (STF/STJ).

DIRETRIZES DE SAÍDA DE DADOS E CÓDIGO (CRÍTICO PARA O SISTEMA):
- Quando o sistema solicitar que você retorne um JSON (como Quizzes, Cronogramas ou Listas de Materiais), retorne EXCLUSIVAMENTE JSON válido, sem texto introdutório ou conclusivo.
- O JSON deve ser perfeitamente parseável (JSON.parse).

DIRETRIZES DE PROFUNDIDADE:
- PROIBIDO ser genérico. Nunca cite apenas "Português" ou "Informática". Especifique os tópicos (ex: "Português: Crase e Regência Verbal", "Informática: Redes de Computadores e Protocolos TCP/IP").
- O Bizu App é focado em ALTO DESEMPENHO.

DIRETRIZES PARA MATERIAIS (APOSTILAS E RESUMOS):
- Crie conteúdos densos, profundos e tecnicamente impecáveis em Markdown.
- Use tabelas, listas, negritos e seções de "Bizus de Prova", "Estratégia de Estudo" e "Estratégia de Prova".

DIRETRIZES PARA QUIZ E QUESTÕES:
- Moldar as questões estritamente ao nível e estilo da prova.
- Explicações e gabaritos pedagógicos, dissecando todas as alternativas.

DIRETRIZES PARA ROTINAS E CRONOGRAMAS:
- Monte cronogramas ultra-realistas com tarefas específicas e métodos de estudo em cada bloco.`;

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES (Devem vir ANTES das rotas) ---
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// --- LISTA UNIVERSAL DE MODELOS ---
// A ordem aqui define a prioridade dentro de cada provedor.
const MODEL_FALLBACK_LIST = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
];

const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "groq/compound",
  "groq/compound-mini",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3.8-27b"
];

const MISTRAL_MODELS = [
  "mistral-large-latest",
  "mistral-medium-latest",
  "mistral-small-latest",
  "ministral-8b-latest",
  "codestral-latest",
  "open-mistral-nemo",
  "mistral-large-2411"
];

const OPENROUTER_MODELS = [
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat"
];

// Estado da IA Primária, Modelos Preferenciais e Chaves salvas em tempo de execução
let runtimePreferredProvider = null;
let runtimePreferredGroqModel = null;
let runtimePreferredMistralModel = null;
const runtimeApiKeys = {
  gemini: '',
  groq: '',
  mistral: '',
  openrouter: ''
};

// Tenta restaurar as preferências e chaves de IA salvas no Supabase no boot do servidor
(async () => {
  if (!supabase) return;
  try {
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'ai_preferred_provider',
        'ai_groq_preferred_model',
        'ai_mistral_preferred_model',
        'ai_gemini_key',
        'ai_groq_key',
        'ai_mistral_key',
        'ai_openrouter_key'
      ]);

    if (settings && Array.isArray(settings)) {
      for (const item of settings) {
        if (!item.value) continue;
        if (item.key === 'ai_preferred_provider') {
          runtimePreferredProvider = item.value;
          console.log(`[Boot] 🤖 IA primária carregada do Supabase: ${runtimePreferredProvider.toUpperCase()}`);
        } else if (item.key === 'ai_groq_preferred_model') {
          runtimePreferredGroqModel = item.value;
          console.log(`[Boot] ⚡ Modelo Groq primário carregado do Supabase: ${runtimePreferredGroqModel}`);
        } else if (item.key === 'ai_mistral_preferred_model') {
          runtimePreferredMistralModel = item.value;
          console.log(`[Boot] 🌪️ Modelo Mistral primário carregado do Supabase: ${runtimePreferredMistralModel}`);
        } else if (item.key === 'ai_gemini_key') {
          runtimeApiKeys.gemini = item.value;
        } else if (item.key === 'ai_groq_key') {
          runtimeApiKeys.groq = item.value;
        } else if (item.key === 'ai_mistral_key') {
          runtimeApiKeys.mistral = item.value;
        } else if (item.key === 'ai_openrouter_key') {
          runtimeApiKeys.openrouter = item.value;
        }
      }
    }
  } catch (e) { }
})();

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
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
      ? rawToken.replace(/^Bearer\\s+/i, '').trim()
      : undefined;

  // Log para depuração
  console.log('Evento Hubla recebido:', JSON.stringify(event, null, 2));

  try {
    const expectedToken = process.env.HUBLA_WEBHOOK_TOKEN;
    
    // Função auxiliar para mascarar o token de forma segura nos logs e respostas
    const maskToken = (token) => {
      if (!token) return 'null/vazio';
      if (token.length <= 6) return '***';
      return token.substring(0, 3) + '...' + token.substring(token.length - 3);
    };

    // Identificar se o token esperado é um placeholder ou não foi configurado corretamente
    const isPlaceholder = (token) => {
      if (!token) return true;
      const lower = token.toLowerCase().trim();
      return (
        lower === '' ||
        lower === 'undefined' ||
        lower === 'null' ||
        lower.includes('placeholder') ||
        lower.includes('seu_token') ||
        lower.includes('sua_chave') ||
        lower.includes('change_me') ||
        lower.includes('insira') ||
        lower.includes('inserir') ||
        lower === 'token'
      );
    };

    // Se o token esperado for um placeholder, liberamos a requisição para evitar que o cliente fique sem acesso.
    if (isPlaceholder(expectedToken)) {
      console.warn(
        `⚠️ [AVISO DE SEGURANÇA HUBLA]: A variável HUBLA_WEBHOOK_TOKEN não está configurada ou possui um valor de placeholder ('${expectedToken}'). ` +
        `O webhook aceitou a requisição sem validação rígida de token para não deixar seus clientes sem acesso. ` +
        `Recomendamos configurar um token real nas variáveis de ambiente do Render e no painel da Hubla.`
      );
    } else {
      // Se houver um token real configurado, validamos estritamente
      if (!hublaToken || hublaToken !== expectedToken) {
        const errorMsg = 
          `Erro de Autenticação: Token de Webhook inválido. ` +
          `Recebido da Hubla: '${maskToken(hublaToken)}', ` +
          `Configurado no Servidor: '${maskToken(expectedToken)}'. ` +
          `Verifique as variáveis de ambiente no Render e o campo 'Token de Segurança' no webhook da Hubla.`;
        
        console.error(`❌ [ERRO DE AUTENTICAÇÃO HUBLA]: ${errorMsg}`);
        return res.status(401).send(errorMsg);
      }
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
      return res.status(200).send('Webhook recebido, mas sem email para processar');
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
    let subscriptionType = 'trial';

    const activeKeywords = [
      'completed', 'approved', 'renewed', 'active', 'granted', 'confirmed', 'paid', 'success'
    ];

    const inactiveKeywords = [
      'cancelled', 'refunded', 'expired', 'removed', 'chargeback', 'deactivated', 'failed'
    ];

    const lowerStatus = status.toLowerCase();
    const isEventActive = activeKeywords.some(kw => lowerStatus.includes(kw));
    const isEventInactive = inactiveKeywords.some(kw => lowerStatus.includes(kw));

    if (isEventActive) {
      isActive = true;

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
        trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);
        subscriptionType = 'mensal';
      }

      console.log(`✅ [LIBERAÇÃO] Evento "${status}" reconhecido como ATIVO para ${email}. Expira em: ${trialEndsAt.toISOString()}`);

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          email: email.trim().toLowerCase(),
          subscription_active: true,
          subscription_type: subscriptionType,
          trial_ends_at: trialEndsAt.toISOString(),
          last_webhook_event: status,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });

      if (profileError) {
        console.error('❌ ERRO CRÍTICO ao atualizar perfil ativo via Webhook:', profileError);
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
      console.log(`ℹ️ [INFO] Evento informativo recebido: ${status} para ${email}`);
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
 */
function extractJSON(text) {
  if (!text) return "{}";

  try {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    if ((cleanText.startsWith('{') && cleanText.endsWith('}')) ||
      (cleanText.startsWith('[') && cleanText.endsWith(']'))) {
      return cleanText;
    }

    const jsonMatch = cleanText.match(/(\{[\\s\\S]*\\}|\\[[\\s\\S]*\\])/);
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
 * Garante que o retorno seja um array
 */
function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
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
    .split(/[,;\\n]/g)
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

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    }
  });

  if (!pageRes.ok) throw new Error('Não foi possível acessar o vídeo do YouTube.');
  const pageHtml = await pageRes.text();

  const titleMatch = pageHtml.match(/<title>([^<]*)<\/title>/);
  const videoTitle = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Vídeo sem título';

  const captionsMatch = pageHtml.match(/"captions":\s*(\{"playerCaptionsTracklistRenderer":\{[^}]*"captionTracks":\[.*?\]\})/);
  
  if (!captionsMatch) {
    console.log('[YouTube] Captions não encontradas no HTML, tentando API direta...');
    const langs = ['pt', 'pt-BR', 'en', 'a.pt', 'a.en'];
    for (const lang of langs) {
      try {
        const apiUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
        const ttRes = await fetch(apiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (ttRes.ok) {
          const ttData = await ttRes.json();
          if (ttData.events && ttData.events.length > 0) {
            const transcript = ttData.events
              .filter(e => e.segs)
              .map(e => e.segs.map(s => s.utf8 || '').join(''))
              .join(' ')
              .replace(/\\n/g, ' ')
              .replace(/\\s+/g, ' ')
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

  let captionsData;
  try {
    const fullCaptionsStr = pageHtml.match(/"captions":(\\{.*?\\}),"videoDetails/s);
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
  const preferredLangs = ['pt-BR', 'pt', 'en'];
  let selectedTrack = null;
  for (const lang of preferredLangs) {
    selectedTrack = tracks.find(t => t.languageCode === lang);
    if (selectedTrack) break;
  }
  if (!selectedTrack) selectedTrack = tracks[0];

  const transcriptUrl = selectedTrack.baseUrl + '&fmt=json3';
  const transcriptRes = await fetch(transcriptUrl);
  if (!transcriptRes.ok) throw new Error('Erro ao baixar transcrição do vídeo.');
  
  const transcriptData = await transcriptRes.json();
  const transcript = transcriptData.events
    .filter(e => e.segs)
    .map(e => e.segs.map(s => s.utf8 || '').join(''))
    .join(' ')
    .replace(/\\n/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

  if (transcript.length < 50) {
    throw new Error('A transcrição do vídeo é muito curta. Tente um vídeo com mais conteúdo.');
  }

  console.log(`[YouTube] Transcrição capturada: ${transcript.length} chars, idioma: ${selectedTrack.languageCode}`);
  return { videoId, videoTitle, transcript, lang: selectedTrack.languageCode };
}

// --- SANITIZAÇÃO DE HISTÓRICO DE CHAT ---
// Garante compatibilidade universal com Gemini, Groq, Mistral e OpenRouter:
// 1. Primeiro item DEVE ser do papel 'user'
// 2. Não deve haver mensagens consecutivas com o mesmo papel
// 3. Ignora conteúdos vazios
function sanitizeChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  
  const normalized = [];
  for (const m of messages) {
    const rawRole = (m.role || 'user').toLowerCase();
    const role = (rawRole === 'model' || rawRole === 'assistant') ? 'assistant' : 'user';
    
    let content = '';
    if (typeof m.content === 'string') content = m.content.trim();
    else if (typeof m.text === 'string') content = m.text.trim();
    else if (Array.isArray(m.parts) && m.parts[0]?.text) content = m.parts[0].text.trim();

    if (!content) continue;
    normalized.push({ role, content });
  }

  if (normalized.length === 0) return [];

  // Se a primeira mensagem for da IA (ex: saudação de boas-vindas do BizuBot), removemos para não quebrar a API
  if (normalized[0].role === 'assistant') {
    normalized.shift();
  }

  if (normalized.length === 0) return [];

  // Agrupa mensagens consecutivas do mesmo papel
  const collapsed = [];
  for (const msg of normalized) {
    if (collapsed.length > 0 && collapsed[collapsed.length - 1].role === msg.role) {
      collapsed[collapsed.length - 1].content += "\\n\\n" + msg.content;
    } else {
      collapsed.push({ ...msg });
    }
  }

  return collapsed;
}

// --- CHAMADA UNIFICADA GEMINI (SDK + REST DIRETO) ---
async function callGemini(geminiInstance, modelName, prompt, isJson = false, history = null, configOverrides = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error("GEMINI_KEY_MISSING");

  // 1. Tentativa via SDK oficial @google/genai
  try {
    if (geminiInstance && geminiInstance.models && typeof geminiInstance.models.generateContent === 'function') {
      const contents = [];
      if (history && history.length > 0) {
        const sanitized = sanitizeChatMessages(history);
        for (const msg of sanitized) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        }
      }
      if (prompt) {
        contents.push({
          role: 'user',
          parts: [{ text: prompt }]
        });
      }

      const config = {
        systemInstruction: BIZU_SYSTEM_PROMPT,
        temperature: configOverrides.temperature !== undefined ? configOverrides.temperature : 0.7,
        safetySettings: SAFETY_SETTINGS,
        ...(isJson ? { responseMimeType: "application/json" } : {}),
        ...(configOverrides.maxOutputTokens ? { maxOutputTokens: configOverrides.maxOutputTokens } : {})
      };

      const response = await geminiInstance.models.generateContent({
        model: modelName,
        contents,
        config
      });

      const text = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || "";
      return { text };
    }
  } catch (sdkErr) {
    const isRateLimit = sdkErr.message?.includes("429") || sdkErr.message?.includes("Quota") || sdkErr.message?.includes("exhausted");
    if (isRateLimit) {
      console.warn(`⚠️ [Gemini SDK] Cota atingida no modelo ${modelName}. Repassando para fallback imediato...`);
      throw sdkErr;
    }
    console.warn(`[Gemini SDK] Falha ao chamar via SDK (${modelName}): ${sdkErr.message}. Acionando REST direto...`);
  }

  // 2. Fallback via REST Oficial do Google Generative Language
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;
  const contents = [];
  if (history && history.length > 0) {
    const sanitized = sanitizeChatMessages(history);
    for (const msg of sanitized) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }
  if (prompt) {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });
  }

  const reqBody = {
    system_instruction: {
      parts: [{ text: BIZU_SYSTEM_PROMPT }]
    },
    contents,
    generationConfig: {
      temperature: configOverrides.temperature !== undefined ? configOverrides.temperature : 0.7,
      ...(isJson ? { responseMimeType: "application/json" } : {}),
      ...(configOverrides.maxOutputTokens ? { maxOutputTokens: configOverrides.maxOutputTokens } : {})
    },
    safetySettings: SAFETY_SETTINGS
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody)
  });

  const rawText = await response.text();
  if (!response.ok) {
    let errorMsg = rawText;
    try {
      const errorData = JSON.parse(rawText || "{}");
      errorMsg = errorData.error?.message || rawText;
    } catch (e) { }

    if (response.status === 429) throw new Error(`RATE_LIMIT:${errorMsg}`);
    throw new Error(errorMsg || `Erro Gemini REST: ${response.status}`);
  }

  const data = JSON.parse(rawText);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { text };
}

function getAIKeys() {
  const geminiKey = (
    runtimeApiKeys.gemini ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  const groqKey = (
    runtimeApiKeys.groq ||
    process.env.GROQ_API_KEY ||
    process.env.GROQ_KEY ||
    process.env.GROQ_APIKEY ||
    process.env.VITE_GROQ_API_KEY ||
    process.env.GROQ ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  const mistralKey = (
    runtimeApiKeys.mistral ||
    process.env.MISTRAL_API_KEY ||
    process.env.MISTRAL_KEY ||
    process.env.MISTRAL_APIKEY ||
    process.env.VITE_MISTRAL_API_KEY ||
    process.env.MISTRAL ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  const openRouterKey = (
    runtimeApiKeys.openrouter ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.VITE_OPENROUTER_API_KEY ||
    process.env.VITE_OPENAI_API_KEY ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  return { geminiKey, groqKey, mistralKey, openRouterKey };
}

function getAI() {
  const { geminiKey, groqKey, mistralKey, openRouterKey } = getAIKeys();

  if (!geminiKey && !openRouterKey && !groqKey && !mistralKey) {
    throw new Error("API_KEY_MISSING");
  }

  const defaultPreferred = groqKey ? 'groq' : (geminiKey ? 'gemini' : (mistralKey ? 'mistral' : 'openrouter'));
  const activeGroqModel = runtimePreferredGroqModel || GROQ_MODELS[0];
  const activeMistralModel = runtimePreferredMistralModel || MISTRAL_MODELS[0];

  return {
    gemini: geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null,
    openRouter: openRouterKey ? {
      apiKey: openRouterKey,
      baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.AI_MODEL || 'google/gemini-2.0-flash-001'
    } : null,
    groq: groqKey ? {
      apiKey: groqKey,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: activeGroqModel
    } : null,
    mistral: mistralKey ? {
      apiKey: mistralKey,
      baseUrl: 'https://api.mistral.ai/v1',
      model: activeMistralModel
    } : null,
    preferredProvider: runtimePreferredProvider || process.env.AI_PROVIDER?.toLowerCase() || defaultPreferred
  };
}

// --- CHAMADA GROQ ---
async function callGroq(config, prompt, isJson = false, history = null, specificModel = null) {
  const cleanKey = config.apiKey ? config.apiKey.trim().replace(/^["']|["']$/g, '') : '';
  const headers = {
    "Authorization": `Bearer ${cleanKey}`,
    "Content-Type": "application/json"
  };

  const messages = history ? sanitizeChatMessages(history) : [];
  if (prompt) {
    messages.push({ role: "user", content: prompt });
  }

  let systemPrompt = BIZU_SYSTEM_PROMPT;
  if (isJson) {
    systemPrompt += "\nIMPORTANTE: Responda SEMPRE em formato JSON estritamente válido.";
  }

  const model = specificModel || config.model || GROQ_MODELS[0];

  const body = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 4000
  };

  if (isJson) {
    body.response_format = { type: "json_object" };
  }

  let response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  });

  let rawText = await response.text();

  // Se o modelo rejeitar response_format (ex: 400 Bad Request por incompatibilidade de json_object), tenta sem response_format
  if (!response.ok && isJson && response.status === 400) {
    try {
      const errObj = JSON.parse(rawText || "{}");
      const errMsg = errObj.error?.message || "";
      if (errMsg.toLowerCase().includes('response_format') || errMsg.toLowerCase().includes('json')) {
        console.log(`[Groq] Modelo ${model} rejeitou response_format json_object. Tentando novamente sem o parâmetro...`);
        delete body.response_format;
        response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body)
        });
        rawText = await response.text();
      }
    } catch (e) { }
  }

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
  return { text: data.choices[0]?.message?.content || "" };
}

// --- CHAMADA MISTRAL ---
async function callMistral(config, prompt, isJson = false, history = null, specificModel = null) {
  const cleanKey = config.apiKey ? config.apiKey.trim().replace(/^["']|["']$/g, '') : '';
  const headers = {
    "Authorization": `Bearer ${cleanKey}`,
    "Content-Type": "application/json"
  };

  const messages = history ? sanitizeChatMessages(history) : [];
  if (prompt) {
    messages.push({ role: "user", content: prompt });
  }

  let systemPrompt = BIZU_SYSTEM_PROMPT;
  if (isJson) {
    systemPrompt += "\nIMPORTANTE: Responda SEMPRE em formato JSON estritamente válido.";
  }

  const model = specificModel || config.model || MISTRAL_MODELS[0];

  const body = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 4000
  };

  if (isJson) {
    body.response_format = { type: "json_object" };
  }

  let response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  });

  // Se o modelo rejeitar response_format (HTTP 400), tenta sem o response_format
  if (response.status === 400 && isJson && body.response_format) {
    console.warn(`[Mistral] Modelo ${model} rejeitou response_format json_object (HTTP 400). Tentando novamente sem response_format...`);
    delete body.response_format;
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });
  }

  const rawText = await response.text();

  if (!response.ok) {
    let errorMsg = rawText;
    try {
      const errorData = JSON.parse(rawText || "{}");
      errorMsg = errorData.message || errorData.error?.message || rawText;
    } catch (e) { }

    if (response.status === 429) throw new Error(`RATE_LIMIT:${errorMsg}`);
    throw new Error(errorMsg || `Erro Mistral: ${response.status}`);
  }

  const data = JSON.parse(rawText);
  return { text: data.choices[0]?.message?.content || "" };
}

// --- CHAMADA OPENROUTER (FALLBACK) ---
async function callOpenRouter(config, prompt, isJson = false, history = null, specificModel = null) {
  const headers = {
    "Authorization": `Bearer ${config.apiKey.trim()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://bizu.app",
    "X-Title": "Bizu App"
  };

  const messages = history ? sanitizeChatMessages(history) : [];
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
}

// --- EXECUTOR UNIVERSAL COM MULTI-FALLBACK SEM BLOQUEIOS ---
async function runWithModelFallback(ai, actionName, payload) {
  // --- PRÉ-PROCESSAMENTO: Buscar info do YouTube ANTES de escolher a IA ---
  if (actionName === 'extractYoutubeContent' && !payload._transcriptFetched) {
    console.log('[YouTube] Buscando informações do vídeo...');
    
    try {
      const { videoId, videoTitle, transcript, lang } = await fetchYoutubeTranscript(payload.youtubeUrl);
      const maxChars = 12000;
      const trimmedTranscript = transcript.length > maxChars 
        ? transcript.substring(0, maxChars) + '... [transcrição cortada por limite de tamanho]'
        : transcript;

      payload._transcriptFetched = true;
      payload._hasTranscript = true;
      payload._videoId = videoId;
      payload._videoTitle = videoTitle;
      payload._transcript = trimmedTranscript;
      payload._lang = lang;
      console.log(`[YouTube] ✅ Transcrição encontrada: "${videoTitle}" (${trimmedTranscript.length} chars, ${lang})`);
    } catch (transcriptError) {
      console.warn(`[YouTube] ⚠️ Transcrição não disponível: ${transcriptError.message}`);
      
      const videoId = extractVideoId(payload.youtubeUrl);
      if (!videoId) throw new Error('URL do YouTube inválida. Verifique o link e tente novamente.');

      let videoTitle = '';
      let videoDescription = '';
      let channelName = '';
      let videoTags = '';

      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          videoTitle = oembedData.title || '';
          channelName = oembedData.author_name || '';
          console.log(`[YouTube/oEmbed] Título: "${videoTitle}", Canal: "${channelName}"`);
        }
      } catch(e) {
        console.warn('[YouTube] oEmbed falhou:', e.message);
      }

      try {
        const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
          }
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          if (!videoTitle) {
            const titleMatch = html.match(/<title>([^<]*)<\/title>/);
            if (titleMatch) videoTitle = titleMatch[1].replace(' - YouTube', '').trim();
          }

          const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
          if (descMatch) {
            videoDescription = descMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .substring(0, 2000);
          }

          const keywordsMatch = html.match(/<meta name="keywords" content="([^"]*)">/);
          if (keywordsMatch) {
            videoTags = keywordsMatch[1];
          }

          if (!channelName) {
            const channelMatch = html.match(/"ownerChannelName":"([^"]*)"/);
            if (channelMatch) channelName = channelMatch[1];
          }

          const categoryMatch = html.match(/"category":"([^"]*)"/);
          if (categoryMatch) {
            payload._videoCategory = categoryMatch[1];
          }
        }
      } catch(e) {
        console.warn('[YouTube] Scraping do HTML falhou:', e.message);
      }

      if (!videoTitle) videoTitle = 'Vídeo do YouTube';

      let fullContext = '';
      if (videoTitle) fullContext += `TÍTULO DO VÍDEO: "${videoTitle}"\\n`;
      if (channelName) fullContext += `CANAL/PROFESSOR: ${channelName}\\n`;
      if (videoTags) fullContext += `PALAVRAS-CHAVE: ${videoTags}\\n`;
      if (payload._videoCategory) fullContext += `CATEGORIA: ${payload._videoCategory}\\n`;
      if (videoDescription) fullContext += `DESCRIÇÃO DO VÍDEO:\\n${videoDescription}\\n`;

      payload._transcriptFetched = true;
      payload._hasTranscript = false;
      payload._videoId = videoId;
      payload._videoTitle = videoTitle;
      payload._transcript = null;
      payload._videoDescription = videoDescription;
      payload._channelName = channelName;
      payload._videoTags = videoTags;
      payload._fullContext = fullContext;
    }
  }

  // Monta a ordem de provedores priorizando a preferência do Admin
  let providersToTry = ['gemini', 'mistral', 'groq', 'openrouter'];
  const preferred = (ai.preferredProvider || '').toLowerCase();

  if (preferred && providersToTry.includes(preferred)) {
    providersToTry = [preferred, ...providersToTry.filter(p => p !== preferred)];
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
            console.warn(`⚠️ Gemini ${model} falhou: ${error.message}. Acionando próximo modelo ou provedor imediatamente...`);
            continue; // Fallback instantâneo, ZERO espera de 60s
          }
        }
      }

      // --- TENTANDO MISTRAL ---
      if (provider === 'mistral' && ai.mistral) {
        const mistralModelsToTry = runtimePreferredMistralModel
          ? [runtimePreferredMistralModel, ...MISTRAL_MODELS.filter(m => m !== runtimePreferredMistralModel)]
          : MISTRAL_MODELS;

        for (const model of mistralModelsToTry) {
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

                let fullContent = skeleton.intro + "\\n\\n";
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
                  fullContent += `## ${part}\\n\\n` + contentRes.text + "\\n\\n";
                  await sleep(300);
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
              const batchSize = 10;
              const totalQuestions = Math.min(payload.numberOfQuestions, 100);
              let allQuestions = [];
              const numBatches = Math.ceil(totalQuestions / batchSize);

              for (let i = 0; i < numBatches; i++) {
                const currentBatchSize = Math.min(batchSize, totalQuestions - allQuestions.length);
                if (currentBatchSize <= 0) break;

                const batchPrompt = `Gere ${currentBatchSize} questões de nível "${payload.difficulty}" sobre "${payload.topic}".
                Responda APENAS JSON. Schema: [{id, text, options:[], correctAnswerIndex:number, explanation}]`;

                const res = await callMistral(ai.mistral, batchPrompt, true, null, model);
                const batchQuestions = ensureArray(JSON.parse(extractJSON(res.text))).map((q, qIdx) => ({
                  ...q,
                  id: q.id && q.id !== 'uuid' && q.id !== 'string' ? String(q.id) : `q-${Date.now()}-${allQuestions.length + qIdx}-${Math.random().toString(36).substring(2, 7)}`
                }));
                allQuestions = [...allQuestions, ...batchQuestions];
              }
              return allQuestions;
            } else if (actionName === 'askTutor') {
              history = payload.history;
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
              const isAcademico = payload.studyType === 'academico';
              if (payload._hasTranscript && payload._transcript) {
                prompt = `Você é o BizuBot, Professor Especialista de Elite.
                Transforme a transcrição deste vídeo em APOSTILA DE ESTUDO completa em Markdown.
                TÍTULO: "${payload._videoTitle}"
                PERFIL: ${isAcademico ? 'ENEM / Vestibular' : 'Concurso Público'}
                DIRETRIZES: Organize em tópicos, adicione macetes, tabelas, destaques e 5 exercícios com gabarito.
                
                TRANSCRIÇÃO:
                ---
                ${payload._transcript}
                ---
                
                Gere a apostila completa em Markdown.`;
              } else {
                const contextData = payload._fullContext || `TÍTULO: "${payload._videoTitle}"`;
                prompt = `Você é o BizuBot, Professor Especialista de Elite.
                
                ===== DADOS DO VÍDEO =====
                ${contextData}
                ==========================
                
                🚨 REGRA: A apostila DEVE ser sobre o EXATO assunto do título acima. NÃO mude de assunto.
                PERFIL: ${isAcademico ? 'ENEM / Vestibular' : 'Concurso Público'}
                
                Gere uma APOSTILA DE ESTUDO completa sobre "${payload._videoTitle}".
                Inclua: teoria completa, macetes, tabelas, destaques "CAI EM PROVA" e 5 exercícios com gabarito.
                Use Markdown rico e profissional.`;
              }
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
            if (actionName === 'extractYoutubeContent') {
              return {
                title: payload._videoTitle || 'Vídeo sem título',
                content: res.text,
                category: 'YouTube',
                type: 'VIDEO',
                videoId: payload._videoId,
                summary: `Material extraído do vídeo "${payload._videoTitle}" — Gerado via Mistral.`
              };
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
        const groqModelsToTry = runtimePreferredGroqModel
          ? [runtimePreferredGroqModel, ...GROQ_MODELS.filter(m => m !== runtimePreferredGroqModel)]
          : GROQ_MODELS;

        for (const model of groqModelsToTry) {
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

                let fullContent = skeleton.intro + "\\n\\n";
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
                  fullContent += `## ${part}\\n\\n` + contentRes.text + "\\n\\n";
                  await sleep(300);
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
              const batchSize = 10;
              const totalQuestions = Math.min(payload.numberOfQuestions, 100);
              let allQuestions = [];
              const numBatches = Math.ceil(totalQuestions / batchSize);

              for (let i = 0; i < numBatches; i++) {
                const currentBatchSize = Math.min(batchSize, totalQuestions - allQuestions.length);
                if (currentBatchSize <= 0) break;

                const batchPrompt = `Gere ${currentBatchSize} questões (${isAcademico ? 'estilo ENEM/Vestibular' : 'estilo Concurso'}) de nível "${payload.difficulty}" sobre "${payload.topic}". 
                IMPORTANTE: NÃO gere questões sobre o exame em si. Gere questões sobre o CONTEÚDO que cai na prova (ex: se o tema for ENEM, escolha Biologia, História, etc).
                Responda APENAS JSON. Schema: [{id, text, options:[], correctAnswerIndex:number, explanation}]`;

                const res = await callGroq(ai.groq, batchPrompt, true, null, model);
                const batchQuestions = ensureArray(JSON.parse(extractJSON(res.text))).map((q, qIdx) => ({
                  ...q,
                  id: q.id && q.id !== 'uuid' && q.id !== 'string' ? String(q.id) : `q-${Date.now()}-${allQuestions.length + qIdx}-${Math.random().toString(36).substring(2, 7)}`
                }));
                allQuestions = [...allQuestions, ...batchQuestions];
              }
              return allQuestions;
            } else if (actionName === 'askTutor') {
              history = payload.history;
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
              JSON Array: [{"institution":"Nome","title":"Cargo/Prova","forecast":"Previsão","status":"Status","salary":"${isAcademico ? 'Inscrição' : 'R$'}", "board":"Banca","url":""}]`;
              isJson = true;
            } else if (actionName === 'createCustomMaterial') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Especialista em ${isAcademico ? 'Educação' : 'Concursos'}. Crie um material estratégico sobre: "${payload.topic}".
              JSON Object: { "title": "...", "category": "...", "type": "PDF", "duration": "...", "summary": "..." }`;
              isJson = true;
            } else if (actionName === 'extractYoutubeContent') {
              const isAcademico = payload.studyType === 'academico';
              if (payload._hasTranscript && payload._transcript) {
                prompt = `Você é o BizuBot, Professor Especialista de Elite.
                Transforme esta transcrição de vídeo em APOSTILA DE ESTUDO completa em Markdown.
                TÍTULO: "${payload._videoTitle}"
                PERFIL: ${isAcademico ? 'ENEM / Vestibular' : 'Concurso Público'}
                DIRETRIZES: Organize em tópicos, adicione macetes, tabelas, destaques e 5 exercícios com gabarito.
                
                TRANSCRIÇÃO:
                ---
                ${payload._transcript}
                ---
                
                Gere a apostila completa em Markdown.`;
              } else {
                const contextData = payload._fullContext || `TÍTULO: "${payload._videoTitle}"`;
                prompt = `Você é o BizuBot, Professor Especialista de Elite.
                
                ===== DADOS DO VÍDEO =====
                ${contextData}
                ==========================
                
                🚨 REGRA: A apostila DEVE ser sobre o EXATO assunto do título acima. NÃO mude de assunto.
                PERFIL: ${isAcademico ? 'ENEM / Vestibular' : 'Concurso Público'}
                
                Gere uma APOSTILA DE ESTUDO completa sobre "${payload._videoTitle}".
                Inclua: teoria completa, macetes, tabelas, destaques "CAI EM PROVA" e 5 exercícios com gabarito.
                Use Markdown rico e profissional.`;
              }
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
            if (actionName === 'extractYoutubeContent') {
              return {
                title: payload._videoTitle || 'Vídeo sem título',
                content: res.text,
                category: 'YouTube',
                type: 'VIDEO',
                videoId: payload._videoId,
                summary: `Material extraído do vídeo "${payload._videoTitle}" — Gerado via Groq.`
              };
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
                const batchQuestions = ensureArray(JSON.parse(extractJSON(res.text))).map((q, qIdx) => ({
                  ...q,
                  id: q.id && q.id !== 'uuid' && q.id !== 'string' ? String(q.id) : `q-${Date.now()}-${allQuestions.length + qIdx}-${Math.random().toString(36).substring(2, 7)}`
                }));
                allQuestions = [...allQuestions, ...batchQuestions];
              }
              return allQuestions;
            } else if (actionName === 'askTutor') {
              history = payload.history;
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
              JSON Array: [{"institution":"Nome","title":"Cargo/Prova","forecast":"Previsão","status":"Status","salary":"${isAcademico ? 'Inscrição' : 'R$'}", "board":"Banca","url":""}]`;
              isJson = true;
            } else if (actionName === 'createCustomMaterial') {
              const isAcademico = payload.studyType === 'academico';
              prompt = `Você é um Especialista em ${isAcademico ? 'Educação' : 'Concursos'}. Crie um material estratégico sobre: "${payload.topic}".
              JSON Object: { "title": "...", "category": "...", "type": "PDF", "duration": "...", "summary": "..." }`;
              isJson = true;
            } else if (actionName === 'extractYoutubeContent') {
              const isAcademico = payload.studyType === 'academico';
              if (payload._hasTranscript && payload._transcript) {
                prompt = `Você é o BizuBot, Professor Especialista de Elite.
                Transforme esta transcrição de vídeo em APOSTILA DE ESTUDO completa em Markdown.
                TÍTULO: "${payload._videoTitle}"
                PERFIL: ${isAcademico ? 'ENEM / Vestibular' : 'Concurso Público'}
                DIRETRIZES: Organize em tópicos, adicione macetes, tabelas, destaques e 5 exercícios com gabarito.
                
                TRANSCRIÇÃO:
                ---
                ${payload._transcript}
                ---
                
                Gere a apostila completa em Markdown.`;
              } else {
                const contextData = payload._fullContext || `TÍTULO: "${payload._videoTitle}"`;
                prompt = `Você é o BizuBot, Professor Especialista de Elite.
                
                ===== DADOS DO VÍDEO =====
                ${contextData}
                ==========================
                
                🚨 REGRA: A apostila DEVE ser sobre o EXATO assunto do título acima. NÃO mude de assunto.
                PERFIL: ${isAcademico ? 'ENEM / Vestibular' : 'Concurso Público'}
                
                Gere uma APOSTILA DE ESTUDO completa sobre "${payload._videoTitle}".
                Inclua: teoria completa, macetes, tabelas, destaques "CAI EM PROVA" e 5 exercícios com gabarito.
                Use Markdown rico e profissional.`;
              }
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
            if (actionName === 'extractYoutubeContent') {
              return {
                title: payload._videoTitle || 'Vídeo sem título',
                content: res.text,
                category: 'YouTube',
                type: 'VIDEO',
                videoId: payload._videoId,
                summary: `Material extraído do vídeo "${payload._videoTitle}" — Gerado via OpenRouter.`
              };
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
      continue;
    }
  }

  throw new Error("Todas as IAs e modelos (Gemini, Mistral, Groq e OpenRouter) atingiram o limite de uso temporário.");
}

// --- HANDLERS DEDICADOS GEMINI ---

async function handleGenerateQuiz(genAI, modelName, { topic, difficulty, numberOfQuestions, studyType }) {
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

    const result = await callGemini(genAI, modelName, prompt, true);
    const batchQuestions = ensureArray(JSON.parse(extractJSON(result.text))).map((q, qIdx) => ({
      ...q,
      id: q.id && q.id !== 'uuid' && q.id !== 'string' ? String(q.id) : `q-${Date.now()}-${allQuestions.length + qIdx}-${Math.random().toString(36).substring(2, 7)}`
    }));
    allQuestions = [...allQuestions, ...batchQuestions];
  }

  return allQuestions;
}

async function handleAskTutor(genAI, modelName, { history, message }) {
  const result = await callGemini(genAI, modelName, message, false, history || []);
  return { text: result.text };
}

async function handleGenerateMaterials(genAI, modelName, { count, studyType }) {
  const prompt = `Você é um Mentor de Estudos e Professor Especialista. Liste ${count} materiais de estudo de alta qualidade.
  Perfil de Estudo do Usuário: ${studyType === 'academico' ? 'ENEM / VESTIBULAR / ACADÊMICO' : 'CONCURSO PÚBLICO'}.
  
  Os materiais devem ser do tipo: "Apostila Completa" ou "Resumo Estratégico".
  Gere sugestões EXATAMENTE para o perfil acima.
  JSON Array: [{"title": "Título da Apostila", "category": "Disciplina", "type": "PDF", "duration": "Número de Páginas/Tempo", "summary": "Breve resumo técnico/estratégico do que será abordado"}]`;

  const result = await callGemini(genAI, modelName, prompt, true);
  return ensureArray(JSON.parse(extractJSON(result.text)));
}

async function handleGenerateMaterialContent(genAI, modelName, { material, studyType }) {
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
    ${section.items.join("\\n")}
    
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

    console.log(`[Material] Gerando ${section.name}...`);
    const result = await callGemini(genAI, modelName, prompt, false, null, { temperature: 0.4, maxOutputTokens: 4000 });
    fullContent += "\\n\\n" + result.text;
    if (i < sections.length - 1) {
      await sleep(1000);
    }
  }

  return { content: fullContent.trim() };
}

async function handleGenerateRoutine(genAI, modelName, { targetExam, hours, subjects, studyType }) {
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
      : `${prompt}\\n\\nRESTRIÇÕES ADICIONAIS (REFORÇO):\\n- Se vier só 1 matéria na lista de prioridade, NÃO faça rotina só dela.\\n- Garanta pelo menos ${minDistinct} matérias distintas ao longo da semana.\\n- Segunda a sábado: inclua pelo menos 2 matérias diferentes por dia.`;

    const result = await callGemini(genAI, modelName, attemptPrompt, true);
    parsed = JSON.parse(extractJSON(result.text));

    if (countDistinctRoutineSubjects(parsed) >= minDistinct) break;
  }

  if (countDistinctRoutineSubjects(parsed) < minDistinct) {
    throw new Error("ROUTINE_LOW_DIVERSITY");
  }

  return parsed;
}

async function handleUpdateRadar(genAI, modelName, { existingTitles: titlesArray, studyType }) {
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

  const result = await callGemini(genAI, modelName, prompt, true);
  const text = extractJSON(result.text);
  const parsed = JSON.parse(text);

  if (parsed.no_updates) {
    return { no_updates: true };
  }

  return ensureArray(parsed);
}

async function handleCreateCustomMaterial(genAI, modelName, { topic, studyType }) {
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

  const result = await callGemini(genAI, modelName, prompt, true);
  return JSON.parse(extractJSON(result.text));
}

async function handleExtendMaterialContent(genAI, modelName, { material, currentContent, studyType }) {
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

  console.log(`[Material] Estendendo conteúdo para "${material.title}"...`);
  const result = await callGemini(genAI, modelName, prompt, false, null, { temperature: 0.5, maxOutputTokens: 4000 });
  return { content: result.text };
}

async function handleExtractYoutubeContent(genAI, modelName, payload) {
  const { _videoTitle, _videoId, _transcript, _hasTranscript, _videoDescription, studyType } = payload;
  const isAcademico = studyType === 'academico';
  let prompt;

  if (_hasTranscript && _transcript) {
    console.log(`[YouTube/Gemini] Gerando apostila a partir da TRANSCRIÇÃO: "${_videoTitle}"`);
    prompt = `Você é o BizuBot, um Professor Especialista de Elite.
    O aluno assistiu a uma videoaula e eu vou te passar a TRANSCRIÇÃO COMPLETA desse vídeo.
    Sua missão é transformar todo o conteúdo dessa videoaula em uma APOSTILA DE ESTUDO completa, profissional e extremamente detalhada.
    
    TÍTULO DO VÍDEO: "${_videoTitle}"
    PERFIL: ${isAcademico ? 'ENEM / Vestibular / Acadêmico' : 'Concurso Público'}
    
    DIRETRIZES OBRIGATÓRIAS:
    1. EXTRAIA TODO O CONTEÚDO: Cubra TODOS os tópicos, conceitos, fórmulas, datas, nomes, leis, exemplos e explicações mencionados no vídeo.
    2. ORGANIZE EM TÓPICOS: Crie uma estrutura clara com títulos (H1, H2, H3), separando cada assunto abordado.
    3. ENRIQUEÇA: Adicione detalhes extras como Macetes de memorização ("Bizu"), tabelas comparativas, destaques e seção "CAI EM PROVA".
    4. EXERCÍCIOS: Adicione ao final 5 questões objetivas baseadas no conteúdo do vídeo, com gabarito comentado.
    5. FORMATO: Use Markdown rico e profissional.
    6. NÃO INVENTE: Baseie-se fielmente na transcrição.
    
    TRANSCRIÇÃO DO VÍDEO:
    ---
    ${_transcript}
    ---
    
    Agora gere a apostila completa em Markdown.`;
  } else {
    console.log(`[YouTube/Gemini] Gerando apostila baseada nos METADADOS: "${_videoTitle}"`);
    const contextData = payload._fullContext || `TÍTULO: "${_videoTitle}"`;
    prompt = `Você é o BizuBot, um Professor Especialista de Elite.
    O aluno assistiu a uma videoaula do YouTube e precisa de uma apostila sobre o EXATO assunto abordado.
    
    ===== DADOS DO VÍDEO =====
    ${contextData}
    ==========================
    
    REGRA CRÍTICA: Gere o material EXCLUSIVAMENTE sobre o assunto indicado no título e descrição do vídeo.
    PERFIL: ${isAcademico ? 'ENEM / Vestibular / Acadêmico' : 'Concurso Público'}
    
    DIRETRIZES OBRIGATÓRIAS:
    1. ASSUNTO CORRETO: O tema da apostila DEVE corresponder ao título do vídeo.
    2. CUBRA O ASSUNTO COMPLETO: Teoria aprofundada com exemplos práticos.
    3. ORGANIZE EM TÓPICOS: Estrutura clara com títulos (H1, H2, H3).
    4. ENRIQUEÇA: Macetes ("Bizu"), tabelas comparativas, destaques "CAI EM PROVA".
    5. EXERCÍCIOS: 5 questões objetivas com gabarito comentado.
    6. FORMATO: Markdown rico e profissional.
    
    Agora gere a apostila completa em Markdown sobre "${_videoTitle}".`;
  }

  const result = await callGemini(genAI, modelName, prompt);
  return {
    title: _videoTitle || 'Vídeo sem título',
    content: result.text,
    category: 'YouTube',
    type: 'VIDEO',
    videoId: _videoId,
    summary: _hasTranscript 
      ? `Material extraído do vídeo "${_videoTitle}" — Conteúdo completo transformado em apostila pelo BizuBot.`
      : `Apostila gerada sobre o tema do vídeo "${_videoTitle}" — Material criado pelo BizuBot baseado no assunto.`
  };
}

async function handleGenerateStudyMaterials(genAI, modelName, { topic, count }) {
  const numMaterials = count || 3;
  let allMaterials = [];

  for (let i = 0; i < numMaterials; i++) {
    console.log(`[StudyMaterials] Gerando material ${i + 1} de ${numMaterials} para "${topic}"...`);

    const skeletonPrompt = `Você é o BizuBot. Gere o TÍTULO e uma BREVE INTRODUÇÃO para uma apostila de alto nível sobre "${topic}". 
    Responda APENAS JSON: { "title": "...", "intro": "..." }`;

    const skeletonResult = await callGemini(genAI, modelName, skeletonPrompt, true);
    const skeleton = JSON.parse(extractJSON(skeletonResult.text));

    const contentResult = await handleGenerateMaterialContent(genAI, modelName, { material: skeleton });

    allMaterials.push({
      id: Date.now() + i,
      title: skeleton.title,
      content: contentResult.content,
      category: topic,
      timestamp: new Date()
    });
  }

  return allMaterials;
}

// --- ROTAS PRINCIPAIS ---

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

    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: "A IA gerou uma resposta inválida. Tente novamente." });
    }

    if (error.message.includes('YouTube') || error.message.includes('legendas') || error.message.includes('transcrição') || error.message.includes('vídeo')) {
      return res.status(400).json({ error: error.message });
    }

    if (error.message.includes('429') || error.message.includes('Quota') || error.message.includes('exhausted') || error.message.includes('atingiram o limite') || error.message.includes('RATE_LIMIT')) {
      return res.status(429).json({ error: "Todas as IAs atingiram o limite de uso temporário. Tente novamente em 1-2 minutos." });
    }

    res.status(503).json({ error: error.message || "Serviço de IA indisponível. Tente novamente em alguns segundos." });
  }
});

// --- ROTAS DE CONFIGURAÇÃO E TESTE DE IA (PAINEL ADMIN) ---

app.get('/api/admin/ai-config', (req, res) => {
  const { geminiKey, groqKey, mistralKey, openRouterKey } = getAIKeys();

  const maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '●●●●●●●●';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  const defaultPreferred = groqKey ? 'groq' : (geminiKey ? 'gemini' : (mistralKey ? 'mistral' : 'openrouter'));

  res.json({
    preferredProvider: runtimePreferredProvider || process.env.AI_PROVIDER?.toLowerCase() || defaultPreferred,
    preferredGroqModel: runtimePreferredGroqModel || GROQ_MODELS[0],
    preferredMistralModel: runtimePreferredMistralModel || MISTRAL_MODELS[0],
    providers: {
      gemini: {
        configured: !!geminiKey,
        maskedKey: maskKey(geminiKey),
        models: MODEL_FALLBACK_LIST
      },
      groq: {
        configured: !!groqKey,
        maskedKey: maskKey(groqKey),
        models: GROQ_MODELS
      },
      mistral: {
        configured: !!mistralKey,
        maskedKey: maskKey(mistralKey),
        models: MISTRAL_MODELS
      },
      openrouter: {
        configured: !!openRouterKey,
        maskedKey: maskKey(openRouterKey),
        models: OPENROUTER_MODELS
      }
    }
  });
});

app.post('/api/admin/ai-config', async (req, res) => {
  const { preferredProvider, preferredGroqModel, preferredMistralModel, keys } = req.body;
  const validProviders = ['gemini', 'groq', 'mistral', 'openrouter'];

  if (preferredProvider && validProviders.includes(preferredProvider.toLowerCase())) {
    runtimePreferredProvider = preferredProvider.toLowerCase();
    console.log(`[Admin] 🔄 Provedor de IA primário atualizado para: ${runtimePreferredProvider.toUpperCase()}`);

    if (supabase) {
      try {
        await supabase
          .from('system_settings')
          .upsert({
            key: 'ai_preferred_provider',
            value: runtimePreferredProvider,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (err) {
        console.warn('[Admin] Não foi possível salvar preferência no Supabase:', err.message);
      }
    }
  }

  if (preferredGroqModel && GROQ_MODELS.includes(preferredGroqModel)) {
    runtimePreferredGroqModel = preferredGroqModel;
    console.log(`[Admin] ⚡ Modelo Groq primário atualizado para: ${runtimePreferredGroqModel}`);

    if (supabase) {
      try {
        await supabase
          .from('system_settings')
          .upsert({
            key: 'ai_groq_preferred_model',
            value: runtimePreferredGroqModel,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (err) { }
    }
  }

  if (preferredMistralModel && MISTRAL_MODELS.includes(preferredMistralModel)) {
    runtimePreferredMistralModel = preferredMistralModel;
    console.log(`[Admin] 🌪️ Modelo Mistral primário atualizado para: ${runtimePreferredMistralModel}`);

    if (supabase) {
      try {
        await supabase
          .from('system_settings')
          .upsert({
            key: 'ai_mistral_preferred_model',
            value: runtimePreferredMistralModel,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (err) { }
    }
  }

  if (keys && typeof keys === 'object') {
    const keyMapping = {
      gemini: 'ai_gemini_key',
      groq: 'ai_groq_key',
      mistral: 'ai_mistral_key',
      openrouter: 'ai_openrouter_key'
    };

    for (const [provider, rawValue] of Object.entries(keys)) {
      if (typeof rawValue === 'string' && rawValue.trim()) {
        const cleanVal = rawValue.trim().replace(/^["']|["']$/g, '');
        runtimeApiKeys[provider] = cleanVal;
        console.log(`[Admin] 🔑 Nova chave salva para: ${provider.toUpperCase()}`);

        if (supabase && keyMapping[provider]) {
          try {
            await supabase
              .from('system_settings')
              .upsert({
                key: keyMapping[provider],
                value: cleanVal,
                updated_at: new Date().toISOString()
              }, { onConflict: 'key' });
          } catch (err) { }
        }
      }
    }
  }

  res.json({
    success: true,
    preferredProvider: runtimePreferredProvider,
    preferredGroqModel: runtimePreferredGroqModel,
    preferredMistralModel: runtimePreferredMistralModel
  });
});

app.post('/api/admin/test-ai', async (req, res) => {
  const { providerToTest } = req.body || {};
  const providers = providerToTest ? [providerToTest] : ['gemini', 'groq', 'mistral', 'openrouter'];
  const testResults = [];
  const { geminiKey, groqKey, mistralKey, openRouterKey } = getAIKeys();

  for (const provider of providers) {
    const start = Date.now();
    try {
      let modelUsed = '';

      if (provider === 'gemini') {
        if (!geminiKey) {
          testResults.push({ provider, status: 'unconfigured', latencyMs: 0, model: MODEL_FALLBACK_LIST[0], error: 'Chave GEMINI_API_KEY não configurada' });
          continue;
        }
        modelUsed = MODEL_FALLBACK_LIST[0];
        const dummyAi = new GoogleGenAI({ apiKey: geminiKey });
        await callGemini(dummyAi, modelUsed, "Responda apenas com a palavra OK.", false);
      } else if (provider === 'groq') {
        if (!groqKey) {
          testResults.push({ provider, status: 'unconfigured', latencyMs: 0, model: GROQ_MODELS[0], error: 'Chave GROQ_API_KEY não configurada' });
          continue;
        }

        const modelsToTest = runtimePreferredGroqModel
          ? [runtimePreferredGroqModel, ...GROQ_MODELS.filter(m => m !== runtimePreferredGroqModel)]
          : GROQ_MODELS;

        let groqSuccess = false;
        let lastGroqError = null;

        for (const testModel of modelsToTest) {
          try {
            modelUsed = testModel;
            const pingRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: testModel,
                messages: [{ role: 'user', content: 'Ping. Responda apenas OK.' }],
                max_tokens: 10,
                temperature: 0.1
              })
            });

            if (!pingRes.ok) {
              const pingErr = await pingRes.json().catch(() => ({}));
              const errMsg = pingErr.error?.message || `HTTP ${pingRes.status}`;
              const err = new Error(errMsg);
              if (pingRes.status === 401 || errMsg.toLowerCase().includes('invalid api key') || errMsg.toLowerCase().includes('unauthorized')) {
                err.isAuthError = true;
              }
              throw err;
            }

            groqSuccess = true;
            break;
          } catch (mErr) {
            lastGroqError = mErr;
            if (mErr.isAuthError) {
              break; // Não tenta os outros 6 modelos se a chave for inválida (falha rápida)
            }
          }
        }

        if (!groqSuccess) {
          throw lastGroqError || new Error('Nenhum modelo Groq respondeu com sucesso.');
        }
      } else if (provider === 'mistral') {
        if (!mistralKey) {
          testResults.push({ provider, status: 'unconfigured', latencyMs: 0, model: MISTRAL_MODELS[0], error: 'Chave MISTRAL_API_KEY não configurada' });
          continue;
        }

        const modelsToTest = runtimePreferredMistralModel
          ? [runtimePreferredMistralModel, ...MISTRAL_MODELS.filter(m => m !== runtimePreferredMistralModel)]
          : MISTRAL_MODELS;

        let mistralSuccess = false;
        let lastMistralError = null;

        for (const testModel of modelsToTest) {
          try {
            modelUsed = testModel;
            const pingRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${mistralKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: testModel,
                messages: [{ role: 'user', content: 'Ping. Responda apenas OK.' }],
                max_tokens: 10,
                temperature: 0.1
              })
            });

            if (!pingRes.ok) {
              const pingErr = await pingRes.json().catch(() => ({}));
              const errMsg = pingErr.message || pingErr.error?.message || `HTTP ${pingRes.status}`;
              const err = new Error(errMsg);
              if (pingRes.status === 401 || errMsg.toLowerCase().includes('invalid api key') || errMsg.toLowerCase().includes('unauthorized')) {
                err.isAuthError = true;
              }
              throw err;
            }

            mistralSuccess = true;
            break;
          } catch (mErr) {
            lastMistralError = mErr;
            if (mErr.isAuthError) {
              break; // Não tenta os outros modelos se a chave for inválida (falha rápida)
            }
          }
        }

        if (!mistralSuccess) {
          throw lastMistralError || new Error('Nenhum modelo Mistral respondeu com sucesso.');
        }
      } else if (provider === 'openrouter') {
        if (!openRouterKey) {
          testResults.push({ provider, status: 'unconfigured', latencyMs: 0, model: OPENROUTER_MODELS[0], error: 'Chave OPENROUTER_API_KEY não configurada' });
          continue;
        }
        modelUsed = OPENROUTER_MODELS[0];
        const pingRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelUsed,
            messages: [{ role: 'user', content: 'Ping. Responda apenas OK.' }],
            max_tokens: 10
          })
        });
        if (!pingRes.ok) {
          const errData = await pingRes.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${pingRes.status}`);
        }
      }

      const latencyMs = Date.now() - start;
      testResults.push({
        provider,
        status: 'online',
        latencyMs,
        model: modelUsed,
        error: null
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      const isRateLimit = err.message.includes('429') || err.message.includes('Quota') || err.message.includes('RATE_LIMIT');
      testResults.push({
        provider,
        status: isRateLimit ? 'rate_limited' : 'error',
        latencyMs,
        model: '',
        error: err.message
      });
    }
  }

  res.json({
    preferredProvider: runtimePreferredProvider || (groqKey ? 'groq' : (geminiKey ? 'gemini' : 'mistral')),
    results: testResults
  });
});

// --- DIAGNÓSTICO E FIX DA TABELA MATERIALS ---
app.get('/api/fix-materials-table', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase não configurado neste servidor.' });
  }
  try {
    const results = [];

    const { data: tableCheck, error: tableErr } = await supabase.rpc('to_regclass', { name: 'public.materials' }).maybeSingle();
    const { data: testSelect, error: selectErr } = await supabase.from('materials').select('id').limit(1);
    
    if (selectErr && selectErr.message.includes('does not exist')) {
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
      if (selectErr.code === '42P01') {
        results.push('❌ Tabela materials NÃO existe no banco!');
      }
    } else {
      results.push('✅ Tabela materials existe e está acessível.');
    }

    const { data: columns, error: colErr } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'materials')
      .eq('table_schema', 'public');
    
    if (colErr) {
      results.push(`⚠️ Não consegui listar colunas via information_schema: ${colErr.message}`);
    } else {
      results.push(`📊 Colunas encontradas: ${JSON.stringify(columns)}`);
    }

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
      if (insertErr.message.includes('column')) {
        results.push(`🔍 Provável coluna faltando! Detalhes: ${insertErr.message}`);
      }
    } else {
      results.push('✅ Insert de teste funcionou!');
      await supabase.from('materials').delete().eq('id', testMaterial.id);
      results.push('🧹 Material de teste limpo.');
    }

    const fixSQL = `
-- ==========================================
-- SQL PARA CRIAR/CORRIGIR TABELA MATERIALS
-- Execute no Supabase Dashboard > SQL Editor
-- ==========================================

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

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

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

