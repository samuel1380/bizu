import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, CheckCircle, TrendingUp, Sparkles, Trophy, Flame } from 'lucide-react';
import { NewsItem } from '../types';
import { getUserStats } from '../services/db';

const MOCK_NEWS: NewsItem[] = [
  { id: '1', title: 'Edital Receita Federal', institution: 'Receita Federal', date: 'Hoje', status: 'Aberto' },
  { id: '2', title: 'Concurso Unificado (CNU)', institution: 'Governo', date: 'Ontem', status: 'Previsto' },
  { id: '3', title: 'Banco do Brasil', institution: 'BB', date: '2d atrás', status: 'Encerrado' },
];

const Home: React.FC = () => {
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalCorrect: 0,
    currentStreak: 0,
    performance: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
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
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero / Call to Action */}
      <div className="flex flex-col md:flex-row gap-6 items-center bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm">
         <div className="flex-1 space-y-4">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-700 tracking-tight">
               Pronto para garantir sua <span className="text-green-500">aprovação?</span>
            </h1>
            <p className="text-slate-500 font-medium text-lg">
               Faça simulados diários e mantenha sua ofensiva para subir de nível.
            </p>
            <div className="flex gap-4 pt-2">
               <Link to="/quiz" className="flex-1 md:flex-none bg-green-500 text-white border-b-4 border-green-700 hover:bg-green-400 active:border-b-0 active:translate-y-1 px-8 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                  TREINAR <ArrowRight size={20} strokeWidth={3} />
               </Link>
               <Link to="/mentor" className="flex-1 md:flex-none bg-white text-blue-500 border-2 border-blue-200 border-b-4 hover:bg-slate-50 active:border-b-2 active:translate-y-[2px] px-8 py-3 rounded-2xl font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                  MENTOR IA
               </Link>
            </div>
         </div>
         <div className="hidden md:flex justify-center items-center w-64">
             {/* Character Placeholder - A big trophy icon */}
             <div className="relative">
                <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 rounded-full"></div>
                <Trophy size={140} className="text-yellow-400 drop-shadow-sm rotate-6" strokeWidth={1.5} />
                <Sparkles size={40} className="absolute top-0 right-0 text-yellow-500 animate-bounce" />
             </div>
         </div>
      </div>

      {/* Stats Row - Duolingo Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Streak */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-4">
           <div className="p-3 bg-orange-100 text-orange-500 rounded-xl border-2 border-orange-200">
              <Flame size={32} strokeWidth={2.5} />
           </div>
           <div>
              <p className="text-2xl font-black text-slate-700">{stats.currentStreak}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dias seguidos</p>
           </div>
        </div>

        {/* Total XP/Questions */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-4">
           <div className="p-3 bg-yellow-100 text-yellow-500 rounded-xl border-2 border-yellow-200">
              <CheckCircle size={32} strokeWidth={2.5} />
           </div>
           <div>
              <p className="text-2xl font-black text-slate-700">{stats.totalQuestions}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Questões</p>
           </div>
        </div>

        {/* Accuracy */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-4">
           <div className="p-3 bg-blue-100 text-blue-500 rounded-xl border-2 border-blue-200">
              <TrendingUp size={32} strokeWidth={2.5} />
           </div>
           <div className="w-full">
              <div className="flex justify-between items-end">
                <p className="text-2xl font-black text-slate-700">{stats.performance}%</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Precisão</p>
              </div>
              <div className="w-full bg-slate-200 h-3 rounded-full mt-1 overflow-hidden">
                 <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{width: `${stats.performance}%`}}
                 ></div>
              </div>
           </div>
        </div>
      </div>

      {/* News / Updates Section */}
      <div>
        <h3 className="text-xl font-bold text-slate-700 mb-4 px-2">Notícias Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MOCK_NEWS.map((news) => (
              <div key={news.id} className="bg-white p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 cursor-pointer transition-all active:scale-[0.98]">
                 <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${
                      news.status === 'Aberto' ? 'bg-green-100 text-green-600' :
                      news.status === 'Previsto' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>{news.status}</span>
                 </div>
                 <h4 className="font-bold text-slate-700 leading-tight mb-3">{news.title}</h4>
                 <div className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <Calendar size={14} className="mr-1.5" /> {news.date}
                 </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Home;