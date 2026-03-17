import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import Materials from './pages/Materials';
import Mentor from './pages/Mentor';
import Schedule from './pages/Schedule';
import Login from './pages/Login';
import Admin from './pages/Admin';
import { supabase } from './services/supabaseClient';
import { ThemeProvider } from './services/ThemeContext';

import { Zap } from 'lucide-react';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  // Timestamp de início da sessão para calcular tempo total
  const sessionStartRef = React.useRef<number | null>(null);
  // Email e ID do usuário logado, usados para salvar tempo ao fechar o browser
  const currentEmailRef = React.useRef<string | null>(null);
  const currentUserIdRef = React.useRef<string | null>(null);
  // Inicializa isRecovering baseado na URL para evitar renderização incorreta da Home
  const [isRecovering, setIsRecovering] = useState(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const isRecovery = hash.includes('type=recovery') ||
      search.includes('type=recovery') ||
      hash.includes('recovery_token=') ||
      hash.includes('access_token=');
    return isRecovery;
  });

  const ADMIN_EMAILS = ['samuelmaislegal345@gmail.com']; // Adicione seu e-mail aqui

  // Atualiza stats de login no banco (last_active_at e login_count)
  const updateLoginStats = async (userId: string, email: string) => {
    try {
      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('login_count')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (fetchErr) console.error('[Admin Stats] Fetch error:', fetchErr.message);

      const currentCount = profile?.login_count || 0;

      // Tenta update por email; se RLS bloquear, tenta por id
      const { error: errEmail } = await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString(), login_count: currentCount + 1 })
        .eq('email', email.toLowerCase());

      if (errEmail) {
        console.warn('[Admin Stats] Update por email bloqueado (RLS?), tentando por id...');
        const { error: errId } = await supabase
          .from('profiles')
          .update({ last_active_at: new Date().toISOString(), login_count: currentCount + 1 })
          .eq('id', userId);
        if (errId) console.error('[Admin Stats] Update por id falhou:', errId.message);
        else console.log('[Admin Stats] ✅ login_count atualizado por id:', currentCount + 1);
      } else {
        console.log('[Admin Stats] ✅ login_count atualizado por email:', currentCount + 1);
      }
    } catch (err) {
      console.error('[Admin Stats] Exceção em updateLoginStats:', err);
    }
  };

  // Salva o tempo gasto na sessão atual no banco
  const saveTimeSpent = async (userId: string, email: string) => {
    if (!sessionStartRef.current) return;
    try {
      const secondsSpent = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (secondsSpent < 5) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('total_time_spent')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      const currentTime = profile?.total_time_spent || 0;
      const newTime = currentTime + secondsSpent;

      const { error: errEmail } = await supabase
        .from('profiles')
        .update({ total_time_spent: newTime })
        .eq('email', email.toLowerCase());

      if (errEmail) {
        await supabase
          .from('profiles')
          .update({ total_time_spent: newTime })
          .eq('id', userId);
      } else {
        console.log('[Admin Stats] ✅ tempo salvo:', secondsSpent, 's');
      }

      sessionStartRef.current = null;
    } catch (err) {
      console.error('[Admin Stats] Exceção em saveTimeSpent:', err);
    }
  };


  useEffect(() => {
    let mounted = true;

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      const hash = window.location.hash;
      const search = window.location.search;
      const isRecoveryUrl = hash.includes('type=recovery') ||
        search.includes('type=recovery') ||
        hash.includes('recovery_token=') ||
        hash.includes('access_token=');

      if (isRecoveryUrl) {
        setIsRecovering(true);
      }

      setSession(session);

      if (session && !isRecoveryUrl) {
        // Sessão já existente (refresh de página) - apenas marca o início do tempo
        sessionStartRef.current = Date.now();
        currentEmailRef.current = session.user.email || null;
        checkSubscription(session.user.email).then(() => {
          if (mounted) {
            setIsAdmin(ADMIN_EMAILS.includes(session.user.email || ''));
            setIsAuthReady(true);
            setLoading(false);
          }
        });
      } else {
        setIsAuthReady(true);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovering(true);
        setSession(session);
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        sessionStartRef.current = Date.now();
        currentEmailRef.current = session.user.email || null;
        currentUserIdRef.current = session.user.id || null;
        updateLoginStats(session.user.id, session.user.email || '');
        checkSubscription(session.user.email);
        setIsAdmin(ADMIN_EMAILS.includes(session.user.email || ''));
        setSession(session);
      } else if (event === 'SIGNED_OUT') {
        if (currentEmailRef.current) {
          saveTimeSpent(currentUserIdRef.current || '', currentEmailRef.current);
          currentEmailRef.current = null;
          currentUserIdRef.current = null;
        }
        setSession(null);
        setHasSubscription(false);
        setIsAdmin(false);
        setIsRecovering(false);
      } else if (session) {
        // TOKEN_REFRESHED e outros eventos com sessão válida
        setSession(session);
        checkSubscription(session.user.email);
        setIsAdmin(ADMIN_EMAILS.includes(session.user.email || ''));
      } else {
        setSession(null);
        setHasSubscription(false);
        setIsAdmin(false);
        setIsRecovering(false);
      }
    });

    // Salva o tempo ao fechar/recarregar o browser sem fazer logout
    const handleBeforeUnload = () => {
      if (currentEmailRef.current && sessionStartRef.current) {
        const secondsSpent = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        if (secondsSpent >= 5) {
          saveTimeSpent(currentUserIdRef.current || '', currentEmailRef.current);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const checkSubscription = async (email: string | undefined) => {
    if (!email) return;

    // Se já estiver verificando, não inicia outra para evitar loops
    if (checkingSubscription) return;

    setCheckingSubscription(true);

    // Pequeno delay inicial para garantir que o banco processou dados recentes
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Busca direta do perfil
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_active, trial_ends_at')
        .eq('email', email.toLowerCase())
        .maybeSingle(); // Usar maybeSingle para evitar erro se o perfil ainda não existir

      // Se o perfil não existe ainda (delay de criação), vamos criar um delay maior e tentar de novo
      if (!data) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: retryData } = await supabase
          .from('profiles')
          .select('subscription_active, trial_ends_at')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        const isSubscriptionActive = retryData?.subscription_active === true;
        const isTrialActive = retryData?.trial_ends_at && new Date(retryData.trial_ends_at) > new Date();
        setHasSubscription(isSubscriptionActive || isTrialActive);
        return;
      }

      const isSubscriptionActive = data.subscription_active === true;
      const isTrialActive = data.trial_ends_at && new Date(data.trial_ends_at) > new Date();

      if (isSubscriptionActive || isTrialActive) {
        setHasSubscription(true);
      } else {
        // Se não encontrou ativo, tenta uma última vez após 3 segundos
        // Isso cobre casos onde o handlePostSignup ou Webhook da Hubla estão lentos
        await new Promise(resolve => setTimeout(resolve, 3000));

        const { data: lastData } = await supabase
          .from('profiles')
          .select('subscription_active, trial_ends_at')
          .eq('email', email.toLowerCase())
          .single();

        const lastIsSubActive = lastData?.subscription_active === true;
        const lastIsTrialActive = lastData?.trial_ends_at && new Date(lastData.trial_ends_at) > new Date();

        setHasSubscription(lastIsSubActive || lastIsTrialActive);
      }
    } catch (err) {
      console.error('Erro ao verificar assinatura:', err);
      // Em caso de erro técnico, não bloqueamos o usuário imediatamente se ele acabou de logar
      // mas aqui vamos manter a segurança
      setHasSubscription(false);
    } finally {
      setCheckingSubscription(false);
    }
  };

  if (!isAuthReady || loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-slate-600 dark:text-slate-400 font-bold animate-pulse">
            Carregando Bizu...
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!session || !session.user?.email_confirmed_at || isRecovering) {
    return (
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login forceRecovery={isRecovering} />} />
            <Route path="*" element={isRecovering ? <Login forceRecovery={true} /> : <Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    );
  }

  // Enquanto verifica a assinatura, mostramos o loading mas mantemos o usuário logado
  if (checkingSubscription) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-slate-600 dark:text-slate-400 font-bold animate-pulse">
            Validando seu acesso...
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!hasSubscription) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-4 py-12 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border-2 border-b-[6px] border-slate-200 dark:border-slate-700 max-w-lg w-full shadow-2xl">
            <div className="w-32 h-32 mx-auto mb-6 drop-shadow-xl">
              <img
                src="/assets/logo.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <h1 className="text-3xl font-black mb-4 text-slate-800 dark:text-white uppercase tracking-tight">Acesso Bloqueado</h1>

            <div className="space-y-4 mb-8">
              <p className="text-slate-600 dark:text-slate-400 font-medium text-lg leading-relaxed">
                Sua conta não possui uma assinatura ativa ou seu período de teste de 3 dias expirou.
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                <p className="text-blue-700 dark:text-blue-300 text-sm font-bold">
                  ⚠️ ATENÇÃO: Use o mesmo e-mail desta conta (<span className="underline">{session?.user?.email}</span>) no momento da compra na Hubla para liberação automática.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => checkSubscription(session?.user?.email)}
                disabled={checkingSubscription}
                className="w-full bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-6 py-4 rounded-2xl border-2 border-b-4 border-blue-200 dark:border-blue-800 font-black text-lg transition-all active:border-b-0 active:translate-y-[2px] flex items-center justify-center gap-2 mb-2"
              >
                {checkingSubscription ? (
                  <>
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    VERIFICANDO...
                  </>
                ) : (
                  <>
                    <Zap size={20} className="fill-current" />
                    JÁ PAGUEI! ATUALIZAR ACESSO
                  </>
                )}
              </button>

              <a
                href="https://pay.hub.la/xvXkxBuJkDGy1T9Tiek4?_path=%2Fr%2Fbizu-app"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-2xl border-b-4 border-blue-800 font-black text-lg transition-all active:border-b-0 active:translate-y-[2px] flex items-center justify-center gap-2"
              >
                LIBERAR ACESSO AGORA
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </a>

              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full mt-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-6 py-3 rounded-2xl font-bold transition-all"
              >
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/mentor" element={<Mentor />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
