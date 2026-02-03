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

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const ADMIN_EMAILS = ['samuelmaislegal345@gmail.com']; // Adicione seu e-mail aqui

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkSubscription(session.user.email);
        setIsAdmin(ADMIN_EMAILS.includes(session.user.email || ''));
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkSubscription(session.user.email);
        setIsAdmin(ADMIN_EMAILS.includes(session.user.email || ''));
      } else {
        setHasSubscription(false);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSubscription = async (email: string | undefined) => {
    if (!email) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_active, trial_ends_at')
      .eq('email', email)
      .single();
    
    const isSubscriptionActive = data?.subscription_active === true;
    const isTrialActive = data?.trial_ends_at && new Date(data.trial_ends_at) > new Date();

    if (isSubscriptionActive || isTrialActive) {
      setHasSubscription(true);
    } else {
      setHasSubscription(false);
    }
  };

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold">
          Carregando...
        </div>
      </ThemeProvider>
    );
  }

  if (!session) {
    return (
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    );
  }

  if (!hasSubscription) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-4 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border-2 border-b-4 border-slate-200 dark:border-slate-700 max-w-md w-full">
            <h1 className="text-3xl font-black mb-4 text-slate-800 dark:text-white uppercase tracking-tight">Assinatura Necessária</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8 font-medium">
              Sua conta não possui uma assinatura ativa ou o e-mail não coincide com a compra na Hubla.
              Verifique seu status na Hubla ou entre em contato com o suporte.
            </p>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="w-full bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-2xl border-b-4 border-red-700 font-bold transition-all active:border-b-0 active:translate-y-[2px]"
            >
              Sair da conta
            </button>
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
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
