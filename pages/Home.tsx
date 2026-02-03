import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, CheckCircle, TrendingUp, Sparkles, Trophy, Flame, DollarSign, Briefcase, Building2, Zap, BookOpen, MessageSquareText, ChevronRight, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { NewsItem } from '../types';
import { getUserStats } from '../services/db';
import { updateContestRadar } from '../services/gemini';
import { supabase } from '../services/supabaseClient';

// Dados iniciais (Cache/Placeholder) para não gastar API no load
const INITIAL_NEWS: NewsItem[] = [
  { 
    id: '1', 
    title: 'Agente e Escrivão', 
    institution: 'Polícia Federal', 
    forecast: '2º Sem/2026', 
    status: 'Solicitado',
    salary: 'R$ 14.000+',
    board: 'A definir'
  },
  { 
    id: '2', 
    title: 'Técnico e Analista', 
    institution: 'MPU', 
    forecast: 'Início de 2026', 
    status: 'Previsto',
    salary: 'Até R$ 13.000',
    board: 'Provável Cebraspe'
  },
  { 
    id: '3', 
    title: 'Auditor Fiscal', 
    institution: 'Receita Federal', 
    forecast: '2026', 
    status: 'Previsto',
    salary: 'R$ 21.000+',
    board: 'FGV'
  },
  { 
    id: '4', 
    title: 'Analista do Seguro Social', 
    institution: 'INSS', 
    forecast: '1º Sem/2026', 
    status: 'Autorizado',
    salary: 'R$ 9.000',
    board: 'A definir'
  },
  { 
    id: '5', 
    title: 'Policial Rodoviário', 
    institution: 'PRF', 
    forecast: 'Fim de 2026', 
    status: 'Solicitado',
    salary: 'R$ 10.000+',
    board: 'Cebraspe'
  },
  { 
    id: '6', 
    title: 'Técnico Bancário', 
    institution: 'Caixa', 
    forecast: '2026', 
    status: 'Previsto',
    salary: 'R$ 4.000 + PLR',
    board: 'Cesgranrio'
  },
];

const Home: React.FC = () => {
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalCorrect: 0,
    currentStreak: 0,
    performance: 0
  });
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshingRadar, setRefreshingRadar] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const ADMIN_EMAILS = ['samuelmaislegal345@gmail.com'];

  // Load Apenas DB Stats (Sem API Call automática)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Verificar se é admin
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setIsAdmin(ADMIN_EMAILS.includes(session.user.email));
        }

        const data = await getUserStats();
        const performance = data.totalQuestions > 0 
          ? Math.round((data.totalCorrect / data.totalQuestions) * 100) 
          : 0;
        
        setStats({
          ...data,
          performance
        });
      } catch (error) {
        console.error("Error fetching stats", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
    // NOTA: Removemos updateContestRadar() daqui para economizar API Quota
  }, []);

  const handleRefreshRadar = async () => {
    setRefreshingRadar(true);
    try {
      const existingTitles = news.map(item => item.institution + " - " + item.title);
      const updatedNews = await updateContestRadar(existingTitles);
      
      if (updatedNews.no_updates) {
        alert("A lista já está atualizada com os concursos mais recentes de 2026!");
      } else {
        setNews(updatedNews);
      }
    } catch (error) {
      console.error("Failed to update radar", error);
      alert("A IA está ocupada no momento (Erro 429). Tente novamente em 1 minuto.");
    } finally {
      setRefreshingRadar(false);
    }
  };

  const getStatusColor = (status: NewsItem['status']) => {
    switch (status) {
        case 'Edital Publicado': return 'bg-red-500 text-white border-red-700';
        case 'Banca Definida': return 'bg-purple-500 text-white border-purple-700';
        case 'Autorizado': return 'bg-green-500 text-white border-green-700';
        case 'Previsto': return 'bg-yellow-400 text-yellow-900 border-yellow-600';
        default: return 'bg-blue-500 text-white border-blue-700';
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 transition-colors duration-300">
      
      {/* Header com Saudação e Stats Compactos */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
            <h1 className="text-2xl font-black text-slate-700 dark:text-slate-200 tracking-tight">
                Olá, Concurseiro! 👋
            </h1>
            <p className="text-slate-400 dark:text-slate-500 font-bold">Vamos bater a meta de hoje?</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl border-b-4 border-slate-950 dark:border-slate-900 hover:bg-slate-900 dark:hover:bg-slate-600 transition-all font-black text-xs">
                  <ShieldCheck size={18} className="text-blue-400" />
                  PAINEL ADMIN
              </Link>
            )}
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-xl border-2 border-b-4 border-slate-200 dark:border-slate-800">
                <Flame className="text-orange-500 fill-current" size={20} />
                <span className="font-black text-slate-600 dark:text-slate-300">{stats.currentStreak}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-xl border-2 border-b-4 border-slate-200 dark:border-slate-800">
                <Trophy className="text-yellow-500 fill-current" size={20} />
                <span className="font-black text-slate-600 dark:text-slate-300">{stats.totalQuestions}</span>
            </div>
        </div>
      </div>

      {/* Hero: Card de "Próximo Passo" (Layout Mobile Otimizado) */}
      <div className="bg-blue-600 dark:bg-blue-700 rounded-3xl p-1 border-b-8 border-blue-800 dark:border-blue-900 shadow-xl transform transition-all hover:scale-[1.01] cursor-pointer group">
         <Link to="/quiz" className="block bg-blue-500 dark:bg-blue-600 rounded-[20px] p-6 md:p-8 relative overflow-hidden border-2 border-blue-400/30">
             {/* Conteúdo flexível: Mobile (lado a lado apertado) / Desktop (lado a lado espaçado) */}
             <div className="relative z-10 flex flex-col gap-6">
                
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                        <span className="inline-block bg-blue-700/50 text-blue-100 text-[10px] md:text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-blue-400/30">
                            Desafio Diário
                        </span>
                        <h2 className="text-2xl md:text-4xl font-black text-white leading-tight">
                            Treinar <br/>Conhecimentos
                        </h2>
                        <p className="text-blue-100 font-medium text-sm md:text-lg max-w-md leading-relaxed">
                            Mantenha sua ofensiva e ganhe XP hoje.
                        </p>
                    </div>

                    {/* Character / Icon - HIDDEN ON MOBILE (hidden md:block) */}
                    <div className="relative flex-shrink-0 hidden md:block">
                         <div className="absolute inset-0 bg-white blur-3xl opacity-20 rounded-full animate-pulse"></div>
                         <Sparkles className="absolute -top-6 -right-6 text-yellow-300 animate-bounce" size={40} />
                         <Trophy className="text-white drop-shadow-lg transform -rotate-12 group-hover:rotate-0 transition-transform duration-300 w-32 h-32" strokeWidth={1.5} />
                    </div>
                </div>
                
                {/* Botão Full Width no Mobile */}
                <div className="pt-2">
                    <span className="flex items-center justify-center gap-2 bg-white text-blue-600 w-full md:w-auto md:inline-flex px-6 py-4 md:py-3 rounded-xl font-black uppercase tracking-widest border-b-4 border-blue-200 group-active:border-b-0 group-active:translate-y-1 transition-all text-sm md:text-base">
                        COMEÇAR AGORA <Zap size={20} className="fill-current" />
                    </span>
                </div>
             </div>
         </Link>
      </div>

      {/* Grid de Ações Rápidas (Botões Quadrados Grandes) */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/mentor" className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 border-b-8 dark:border-b-slate-950 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200 dark:hover:border-green-800 hover:border-b-green-400 group transition-all active:border-b-2 active:translate-y-[6px]">
            <div className="mb-4 bg-green-100 dark:bg-green-900/30 w-14 h-14 rounded-2xl flex items-center justify-center border-2 border-green-200 dark:border-green-800 group-hover:scale-110 transition-transform">
                <MessageSquareText size={28} className="text-green-600 dark:text-green-400" strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 leading-tight mb-1">Mentor IA</h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Tirar Dúvidas</p>
        </Link>

        <Link to="/materials" className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 border-b-8 dark:border-b-slate-950 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-200 dark:hover:border-purple-800 hover:border-b-purple-400 group transition-all active:border-b-2 active:translate-y-[6px]">
            <div className="mb-4 bg-purple-100 dark:bg-purple-900/30 w-14 h-14 rounded-2xl flex items-center justify-center border-2 border-purple-200 dark:border-purple-800 group-hover:scale-110 transition-transform">
                <BookOpen size={28} className="text-purple-600 dark:text-purple-400" strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 leading-tight mb-1">Materiais</h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Biblioteca</p>
        </Link>
      </div>

      {/* Radar de Concursos (Horizontal Scroll - App Feel) */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-xl font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Briefcase className="text-blue-500 fill-current" />
                Radar 2026
            </h3>
            
            <button 
              onClick={handleRefreshRadar}
              disabled={refreshingRadar}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-2 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800 active:border-blue-200 transition-all text-xs font-bold uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {refreshingRadar ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> IA Buscando...
                </>
              ) : (
                <>
                  <RefreshCw size={14} /> Atualizar
                </>
              )}
            </button>
        </div>
        
        {/* Scroll Container com Snap */}
        <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory -mx-4 px-4 scrollbar-hide">
            {news.map((item) => (
              <div key={item.id} className="snap-center shrink-0 w-80 bg-white dark:bg-slate-900 p-5 rounded-3xl border-2 border-slate-200 dark:border-slate-800 border-b-4 dark:border-b-slate-950 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group relative">
                 
                 {/* Status Badge Pills */}
                 <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide border-b-2 ${getStatusColor(item.status)}`}>
                        {item.status}
                    </span>
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                        <Building2 size={12} /> {item.board}
                    </div>
                 </div>

                 <h4 className="font-black text-lg text-slate-700 dark:text-slate-200 leading-tight mb-1">
                    {item.institution}
                 </h4>
                 <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mb-4">{item.title}</p>
                 
                 <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase flex items-center gap-1">
                            <Calendar size={14} /> Data
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{item.forecast}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase flex items-center gap-1">
                            <DollarSign size={14} /> Salário
                        </span>
                        <span className="font-black text-green-600 dark:text-green-400 text-xs">
                            {item.salary}
                        </span>
                    </div>
                 </div>
                 
                 {/* Ícone sutil de Link se existir */}
                 <div className="absolute top-1/2 right-4 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                     {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800">
                          <ExternalLink size={20} />
                        </a>
                     ) : (
                        <ChevronRight className="text-slate-300 dark:text-slate-600" />
                     )}
                 </div>
              </div>
            ))}
        </div>
      </div>

    </div>
  );
};

export default Home;