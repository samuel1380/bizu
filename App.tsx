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
      .select('subscription_active')
      .eq('email', email)
      .single();
    
    if (data?.subscription_active) {
      setHasSubscription(true);
    } else {
      setHasSubscription(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando...</div>;
  }

  if (!session) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  if (!hasSubscription) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white px-4 text-center">
        <h1 className="text-3xl font-bold mb-4">Assinatura Necessária</h1>
        <p className="text-gray-400 mb-8 max-w-md">
          Sua conta não possui uma assinatura ativa ou o e-mail não coincide com a compra na Hubla.
          Verifique seu status na Hubla ou entre em contato com o suporte.
        </p>
        <button 
          onClick={() => supabase.auth.signOut()}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md transition-colors"
        >
          Sair da conta
        </button>
      </div>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/mentor" element={<Mentor />} />
          <Route path="/schedule" element={<Schedule />} />
          {isAdmin && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
