import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  TrendingUp,
  Users,
  ShoppingCart,
  CheckCircle,
  Mail,
  Zap,
  ArrowLeft,
  Calendar,
  DollarSign,
  Briefcase,
  Search,
  Filter,
  ArrowUpRight,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Cpu,
  Activity,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Check,
  Server,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area
} from 'recharts';
import {
  getAiConfig,
  saveAiConfig,
  testAiProviders,
  AIConfigResponse,
  AITestItem
} from '../services/gemini';

interface SalesEvent {
  id: string;
  email: string;
  event_type: string;
  created_at: string;
  raw_data: any;
}

interface Profile {
  email: string;
  subscription_active: boolean;
  last_webhook_event: string;
  updated_at: string;
  created_at: string;
  last_login?: string;
  last_active_at?: string;
  total_time_spent?: number;
  login_count?: number;
}

export default function Admin() {
  const [events, setEvents] = useState<SalesEvent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState<'sales' | 'users' | 'ai'>('sales');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [stats, setStats] = useState({
    totalSales: 0,
    salesToday: 0,
    salesMonth: 0,
    revenueTotal: 0,
    revenueMonth: 0,
    activeSubscriptions: 0,
    abandonedCarts: 0,
    totalLeads: 0
  });

  // Estado da Configuração de IA
  const [aiConfig, setAiConfig] = useState<AIConfigResponse | null>(null);
  const [selectedPrimaryAi, setSelectedPrimaryAi] = useState<string>('gemini');
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [aiSaveSuccess, setAiSaveSuccess] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [testResults, setTestResults] = useState<AITestItem[]>([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    await Promise.all([fetchEvents(), fetchProfiles(), fetchAiSettings()]);
    setLoading(false);
  }

  async function fetchAiSettings() {
    try {
      const cfg = await getAiConfig();
      setAiConfig(cfg);
      if (cfg?.preferredProvider) {
        setSelectedPrimaryAi(cfg.preferredProvider);
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações de IA:', e);
    }
  }

  async function handleSaveAiProvider(provider: string) {
    setSavingAiConfig(true);
    try {
      await saveAiConfig(provider);
      setSelectedPrimaryAi(provider);
      setAiSaveSuccess(true);
      setTimeout(() => setAiSaveSuccess(false), 3000);
      await fetchAiSettings();
    } catch (err: any) {
      alert(`Erro ao salvar IA primária: ${err.message}`);
    } finally {
      setSavingAiConfig(false);
    }
  }

  async function handleTestAllAis() {
    setTestingAi(true);
    try {
      const res = await testAiProviders();
      setTestResults(res.results);
      if (res.preferredProvider) {
        setSelectedPrimaryAi(res.preferredProvider);
      }
    } catch (err: any) {
      alert(`Erro ao testar IAs: ${err.message}`);
    } finally {
      setTestingAi(false);
    }
  }

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('sales_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setEvents(data);
        calculateDetailedStats(data);
      }
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
    }
  }

  async function fetchProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setProfiles(data);
      }
    } catch (err) {
      console.error('Erro ao buscar perfis:', err);
    }
  }

  function calculateDetailedStats(data: SalesEvent[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const isSuccess = (type: string) => [
      'order_completed',
      'approved',
      'subscription_renewed',
      'subscription_active',
      'access_granted',
      'payment_confirmed',
      'invoice_paid',
      'purchase_approved'
    ].includes(type);

    const isAbandoned = (type: string) => [
      'lead_abandoned_cart',
      'abandoned_cart',
      'cart_abandoned',
      'lead'
    ].includes(type.toLowerCase()) || type.toLowerCase().includes('abandoned') || type.toLowerCase().includes('abandonado');

    let totalSales = 0;
    let salesToday = 0;
    let salesMonth = 0;
    let revenueTotal = 0;
    let revenueMonth = 0;
    let abandonedCarts = 0;
    let abandonedToday = 0;

    data.forEach(event => {
      const eventDate = new Date(event.created_at);

      // Tentar extrair o preço real do payload da Hubla
      let price = 0;
      if (event.raw_data?.data?.price) {
        price = Number(event.raw_data.data.price);
      } else if (event.raw_data?.price) {
        price = Number(event.raw_data.price);
      } else if (event.raw_data?.data?.amount) {
        price = Number(event.raw_data.data.amount) / 100; // Hubla às vezes envia em centavos
      } else {
        price = 97; // Fallback se não encontrar nada
      }

      if (isSuccess(event.event_type)) {
        totalSales++;
        revenueTotal += price;

        if (eventDate >= today) {
          salesToday++;
        }
        if (eventDate >= firstDayOfMonth) {
          salesMonth++;
          revenueMonth += price;
        }
      }

      if (isAbandoned(event.event_type)) {
        abandonedCarts++;
        if (eventDate >= today) {
          abandonedToday++;
        }
      }
    });

    const leads = new Set(data.map(e => e.email)).size;

    setStats({
      totalSales,
      salesToday,
      salesMonth,
      revenueTotal,
      revenueMonth,
      activeSubscriptions: totalSales,
      abandonedCarts,
      totalLeads: leads
    });
  }

  const getEventBadge = (type: string) => {
    const success = ['order_completed', 'approved', 'subscription_renewed', 'subscription_active', 'purchase_approved', 'payment_confirmed'];
    const danger = ['subscription_cancelled', 'refunded', 'expired', 'chargeback', 'payment_failed'];
    const warning = ['lead_abandoned_cart', 'abandoned_cart', 'cart_abandoned', 'lead'];

    const lowerType = type.toLowerCase();
    if (success.includes(lowerType)) return 'bg-green-500 text-white border-green-700';
    if (danger.includes(lowerType)) return 'bg-red-500 text-white border-red-700';
    if (warning.includes(lowerType) || lowerType.includes('abandon')) return 'bg-orange-500 text-white border-orange-700';
    return 'bg-blue-500 text-white border-blue-700';
  };

  const formatEventType = (type: string) => {
    if (type === 'lead_abandoned_cart') return '🛒 Carrinho Abandonado';
    if (type === 'purchase_approved' || type === 'approved') return '✅ Compra Aprovada';
    if (type === 'payment_confirmed') return '💰 Pagamento Confirmado';
    if (type === 'order_completed') return '🎉 Pedido Completo';
    if (type === 'subscription_active') return '🔄 Assinatura Ativa';
    if (type === 'subscription_renewed') return '♻️ Renovação';
    if (type === 'lead') return '📧 Novo Lead';
    return type.replace(/_/g, ' ').toUpperCase();
  };

  const filteredEvents = events.filter(e =>
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.event_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 dark:text-slate-400 font-bold">Carregando Dashboard...</p>
      </div>
    </div>
  );

  const formatTimeSpent = (seconds?: number) => {
    if (!seconds) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  };

  // Prepara dados pro gráfico
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const chartData = last7Days.map(dateStr => {
    const dayEvents = events.filter(e => e.created_at.startsWith(dateStr));
    const daySales = dayEvents.filter(e => getEventBadge(e.event_type).includes('green')).length;
    const dateObj = new Date(dateStr);
    return {
      name: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
      Vendas: daySales
    };
  });

  const filteredProfiles = profiles.filter(p =>
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const usersPerPage = 6; // Usando 6 para manter as 2 colunas niveladas (3 linhas de 2).
  const totalUsersPages = Math.ceil(filteredProfiles.length / usersPerPage);
  const paginatedProfiles = filteredProfiles.slice(
    (usersPage - 1) * usersPerPage,
    usersPage * usersPerPage
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 px-4 pt-4 bg-slate-50 dark:bg-slate-900 min-h-screen">

      {/* Header com Visual do App */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Link to="/" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black mb-2 hover:underline">
            <ArrowLeft size={18} /> VOLTAR AO APP
          </Link>
          <h1 className="text-3xl font-black text-slate-700 dark:text-slate-100 tracking-tight">
            Dashboard de Controle ⚙️
          </h1>
          <p className="text-slate-400 dark:text-slate-500 font-bold">Gerencie vendas e alunos do Bizu</p>
        </div>

        <div className="flex gap-3">
          <button onClick={fetchAllData} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl border-b-4 border-blue-700 hover:bg-blue-600 transition-all font-black text-sm">
            ATUALIZAR TUDO
          </button>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-200 dark:bg-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${activeTab === 'sales' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          VENDAS & EVENTOS
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${activeTab === 'users' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          LISTA DE ALUNOS ({profiles.length})
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-6 py-2 rounded-xl font-black text-sm transition-all flex items-center gap-2 ${activeTab === 'ai' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          <Cpu size={16} /> CONFIGURAÇÃO DE IA & STATUS
        </button>
      </div>

      {/* Exibe Métricas e Busca somente nas abas de Vendas e Alunos */}
      {activeTab !== 'ai' && (
        <>
          {/* Grid de Faturamento e Vendas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Vendas Hoje" value={stats.salesToday} icon={<Zap />} color="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400" borderColor="border-yellow-200 dark:border-yellow-800/50" borderBottomColor="border-b-yellow-400 dark:border-b-yellow-600" />
            <StatCard title="Vendas Mês" value={stats.salesMonth} icon={<TrendingUp />} color="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" borderColor="border-green-200 dark:border-green-800/50" borderBottomColor="border-b-green-400 dark:border-b-green-600" />
            <StatCard title="Abandonos" value={stats.abandonedCarts} icon={<ShoppingCart />} color="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" borderColor="border-orange-200 dark:border-orange-800/50" borderBottomColor="border-b-orange-400 dark:border-b-orange-600" />
            <StatCard title="Faturamento Total" value={`R$ ${stats.revenueTotal.toLocaleString()}`} icon={<DollarSign />} color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" borderColor="border-blue-200 dark:border-blue-800/50" borderBottomColor="border-b-blue-400 dark:border-b-blue-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-700 border-b-8 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-700 dark:text-slate-100 uppercase tracking-tight">Resumo de Conversão</h3>
                <div className="bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Tempo Real</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-black text-slate-700 dark:text-slate-100">{stats.totalLeads}</p>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Total Leads</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{stats.totalSales}</p>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Vendas</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-orange-500 dark:text-orange-400">{stats.abandonedCarts}</p>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Abandonos</p>
                </div>
              </div>
              <div className="mt-8 h-48 w-full border-t-2 border-slate-100 dark:border-slate-700 pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="Vendas" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-700 border-b-8 flex flex-col justify-center text-center">
              <div className="mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30 w-16 h-16 rounded-full flex items-center justify-center border-2 border-purple-200 dark:border-purple-800/50">
                <Users className="text-purple-600 dark:text-purple-400" size={32} />
              </div>
              <h3 className="text-4xl font-black text-slate-700 dark:text-slate-100">{stats.activeSubscriptions}</h3>
              <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-sm">Alunos Ativos</p>
            </div>
          </div>

          {/* Barra de Busca e Filtros */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
            <input
              type="text"
              placeholder={activeTab === 'sales' ? "Buscar por e-mail, evento ou status..." : "Buscar aluno por e-mail..."}
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-b-4 border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-blue-500 transition-all font-bold text-slate-600 dark:text-slate-300 shadow-sm"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setUsersPage(1); // Retorna à primeira página ao digitar na busca
              }}
            />
          </div>
        </>
      )}

      {activeTab === 'sales' && (
        <div className="space-y-4">
          <h3 className="text-xl font-black text-slate-700 dark:text-slate-100 flex items-center gap-2 px-2">
            <Clock className="text-blue-500" />
            Histórico Detalhado
          </h3>

          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <div key={event.id} className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-4 overflow-hidden transition-all group">
                <div
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${getEventBadge(event.event_type).includes('green') ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30' : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600'}`}>
                      <Mail className={getEventBadge(event.event_type).includes('green') ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'} size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-700 dark:text-slate-100 leading-tight">
                        {event.email}
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-1">
                        <Calendar size={12} />
                        {new Date(event.created_at).toLocaleString('pt-BR')}
                        <span className="mx-1">•</span>
                        <span>{event.raw_data?.data?.offer_name || event.raw_data?.offer_name || 'Bizu App'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide border-2 ${getEventBadge(event.event_type)}`}>
                      {formatEventType(event.event_type)}
                    </span>
                    <div className="text-slate-400 dark:text-slate-500">
                      {selectedEvent === event.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Detalhes do Webhook (JSON) */}
                {selectedEvent === event.id && (
                  <div className="p-4 bg-slate-900 text-blue-300 font-mono text-xs overflow-x-auto border-t-2 border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
                      <span className="text-slate-500 font-bold uppercase tracking-widest">DADOS BRUTOS DO WEBHOOK</span>
                      <button
                        onClick={() => console.log(event.raw_data)}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded transition-colors"
                      >
                        LOG NO CONSOLE
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(event.raw_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {filteredEvents.length === 0 && (
              <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-slate-400 dark:text-slate-500 font-bold italic">Nenhum evento encontrado para esta busca.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <h3 className="text-xl font-black text-slate-700 dark:text-slate-100 flex items-center gap-2 px-2">
            <Users className="text-blue-500" />
            Lista Geral de Alunos
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedProfiles.map((profile) => (
              <div key={profile.email} className="bg-white dark:bg-slate-800 p-5 rounded-3xl border-2 border-slate-200 dark:border-slate-700 border-b-8 flex flex-col group hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                <div className="flex items-start justify-between mb-4 border-b-2 border-slate-100 dark:border-slate-700 pb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 border-b-4 ${profile.subscription_active ? 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/30' : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                      <Users size={24} className={profile.subscription_active ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'} />
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-slate-700 dark:text-slate-100 leading-tight truncate max-w-[200px]">{profile.email}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${profile.subscription_active ? 'bg-green-500 text-white' : 'bg-slate-400 text-white'}`}>
                          {profile.subscription_active ? 'ATIVO' : 'INATIVO'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          ID. {profile.created_at ? profile.created_at.split('T')[0] : (profile.updated_at ? new Date(profile.updated_at).toLocaleDateString('pt-BR') : 'Sem data')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
                      {profile.last_webhook_event || 'SEM WEBHOOK'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col items-center">
                    <Clock size={16} className="text-blue-500 mb-1" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Último Acesso</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                      {profile.last_active_at ? new Date(profile.last_active_at).toLocaleDateString() : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center border-l border-r border-slate-200 dark:border-slate-700">
                    <TrendingUp size={16} className="text-purple-500 mb-1" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Total Logins</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{profile.login_count || 1}x</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Zap size={16} className="text-yellow-500 mb-1" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Tempo Total</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{formatTimeSpent(profile.total_time_spent)}</span>
                  </div>
                </div>
              </div>
            ))}

            {filteredProfiles.length === 0 && (
              <div className="md:col-span-2 bg-white dark:bg-slate-800 p-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-slate-400 dark:text-slate-500 font-bold italic">Nenhum aluno cadastrado/encontrado no sistema.</p>
              </div>
            )}
          </div>

          {/* Navegação/Paginação de Alunos */}
          {totalUsersPages > 1 && (
            <div className="flex items-center justify-between mt-6 p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm mx-auto w-full md:w-2/3">
              <button
                onClick={() => setUsersPage(prev => Math.max(prev - 1, 1))}
                disabled={usersPage === 1}
                className="px-6 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-sm rounded-xl disabled:opacity-30 transition-all hover:bg-slate-200 dark:hover:bg-slate-600 uppercase border-b-4 border-slate-200 dark:border-slate-600 disabled:border-b-0 disabled:translate-y-[4px]"
              >
                Anterior
              </button>

              <span className="font-bold text-xs md:text-sm text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Página <span className="text-blue-500 font-black">{usersPage}</span> de {totalUsersPages}
              </span>

              <button
                onClick={() => setUsersPage(prev => Math.min(prev + 1, totalUsersPages))}
                disabled={usersPage === totalUsersPages}
                className="px-6 py-2 bg-blue-500 text-white font-black text-sm rounded-xl disabled:opacity-30 transition-all hover:bg-blue-600 border-b-4 border-blue-700 disabled:border-b-0 disabled:translate-y-[4px] uppercase"
              >
                Próximo
              </button>
            </div>
          )}
        </div>
      )}

      {/* ABA DE CONFIGURAÇÃO DE IA E STATUS */}
      {activeTab === 'ai' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Alerta de Sucesso ao Salvar */}
          {aiSaveSuccess && (
            <div className="p-4 bg-green-500/10 border-2 border-green-500 rounded-2xl flex items-center gap-3 text-green-700 dark:text-green-300 font-bold shadow-sm">
              <Check className="text-green-600 dark:text-green-400 shrink-0" size={24} />
              <span>Configuração salva com sucesso! O Bizu App agora usará o provedor selecionado como primeira opção.</span>
            </div>
          )}

          {/* CARD 1: SELETOR DE IA PRIMÁRIA */}
          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-700 border-b-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Sliders size={20} />
                  </span>
                  <h3 className="text-2xl font-black text-slate-700 dark:text-slate-100 tracking-tight">
                    Provedor Primário de Inteligência Artificial
                  </h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
                  Escolha qual IA deve responder as requisições dos alunos primeiro. Se ela estiver indisponível ou em limite de cota (429), o sistema usará as outras automaticamente.
                </p>
              </div>

              <button
                onClick={() => handleSaveAiProvider(selectedPrimaryAi)}
                disabled={savingAiConfig}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 font-black text-sm transition-all shadow-md shrink-0 disabled:opacity-50"
              >
                {savingAiConfig ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    SALVANDO...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    SALVAR PREFERÊNCIA
                  </>
                )}
              </button>
            </div>

            {/* Grid de Provedores */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Google Gemini */}
              <div
                onClick={() => setSelectedPrimaryAi('gemini')}
                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                  selectedPrimaryAi === 'gemini'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                      G
                    </div>
                    {selectedPrimaryAi === 'gemini' && (
                      <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        ATIVO PRIMÁRIO
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">Google Gemini</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-3">
                    Ideal para geração de apostilas densas, cronogramas e materiais com grande volume de texto.
                  </p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modelos Ativos:</span>
                  <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 truncate">
                    gemini-2.0-flash, 1.5-flash
                  </p>
                </div>
              </div>

              {/* Groq Cloud */}
              <div
                onClick={() => setSelectedPrimaryAi('groq')}
                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                  selectedPrimaryAi === 'groq'
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/20 shadow-md ring-2 ring-orange-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black">
                      ⚡
                    </div>
                    {selectedPrimaryAi === 'groq' && (
                      <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        ATIVO PRIMÁRIO
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">Groq Cloud</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-3">
                    Velocidade absurda (LPU). Respostas quase instantâneas para Quizzes e Mentor BizuBot.
                  </p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modelos Ativos:</span>
                  <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 truncate">
                    llama-3.3-70b-versatile, 3.1-8b
                  </p>
                </div>
              </div>

              {/* Mistral AI */}
              <div
                onClick={() => setSelectedPrimaryAi('mistral')}
                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                  selectedPrimaryAi === 'mistral'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                      M
                    </div>
                    {selectedPrimaryAi === 'mistral' && (
                      <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        ATIVO PRIMÁRIO
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">Mistral AI</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-3">
                    Altíssima capacidade lógica e raciocínio refinado para questões de alta dificuldade de concursos.
                  </p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modelos Ativos:</span>
                  <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 truncate">
                    mistral-large-2411, nemo
                  </p>
                </div>
              </div>

              {/* OpenRouter */}
              <div
                onClick={() => setSelectedPrimaryAi('openrouter')}
                className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                  selectedPrimaryAi === 'openrouter'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                      OR
                    </div>
                    {selectedPrimaryAi === 'openrouter' && (
                      <span className="bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        ATIVO PRIMÁRIO
                      </span>
                    )}
                  </div>
                  <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">OpenRouter</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-3">
                    Roteador multi-provedor global para contingência final com dezenas de modelos de reserva.
                  </p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modelos Ativos:</span>
                  <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 truncate">
                    gemini-2.0, llama-3.3, deepseek
                  </p>
                </div>
              </div>
            </div>

            {/* Cadeia de Contingência Dinâmica */}
            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                Ordem Automática de Fallback (Sem Bloqueio de 60s):
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                <span className="px-3 py-1 bg-blue-600 text-white rounded-lg uppercase shadow-sm">
                  1. {selectedPrimaryAi.toUpperCase()} (PRIMÁRIO)
                </span>
                <span className="text-slate-400">➜</span>
                {['gemini', 'mistral', 'groq', 'openrouter']
                  .filter(p => p !== selectedPrimaryAi)
                  .map((p, idx) => (
                    <React.Fragment key={p}>
                      <span className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg uppercase">
                        {idx + 2}. {p.toUpperCase()}
                      </span>
                      {idx < 2 && <span className="text-slate-400">➜</span>}
                    </React.Fragment>
                  ))}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-2">
                ⚡ Se a IA primária sofrer lentidão ou atingir 429 (limite de cota), o sistema salta instantaneamente para a próxima sem congelar a navegação do usuário.
              </p>
            </div>
          </div>

          {/* CARD 2: DIAGNÓSTICO EM TEMPO REAL E TESTE DE CONEXÃO */}
          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-700 border-b-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b-2 border-slate-100 dark:border-slate-700 pb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
                    <Activity size={20} />
                  </span>
                  <h3 className="text-2xl font-black text-slate-700 dark:text-slate-100 tracking-tight">
                    Status e Conectividade das APIs em Tempo Real
                  </h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
                  Execute um teste de ping real em todas as chaves de API configuradas no Render para verificar latência e disponibilidade.
                </p>
              </div>

              <button
                onClick={handleTestAllAis}
                disabled={testingAi}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 font-black text-sm transition-all shadow-md shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={testingAi ? "animate-spin" : ""} size={18} />
                {testingAi ? "TESTANDO PROVEDORES..." : "TESTAR TODAS AS IAS AGORA"}
              </button>
            </div>

            {/* Lista de Resultados de Teste */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['gemini', 'groq', 'mistral', 'openrouter'].map((provider) => {
                const result = testResults.find(r => r.provider === provider);
                const isConfigured = aiConfig?.providers?.[provider]?.configured;

                return (
                  <div
                    key={provider}
                    className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-base text-slate-800 dark:text-slate-100 uppercase">
                            {provider === 'openrouter' ? 'OpenRouter' : provider.toUpperCase()}
                          </h4>
                          {selectedPrimaryAi === provider && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md font-black text-[10px] uppercase">
                              Primária
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          {provider === 'gemini' && 'Google Gemini API'}
                          {provider === 'groq' && 'Groq LPU Inference'}
                          {provider === 'mistral' && 'Mistral AI Platform'}
                          {provider === 'openrouter' && 'OpenRouter AI Gateway'}
                        </span>
                      </div>

                      {/* Status Badge */}
                      {result ? (
                        result.status === 'online' ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 rounded-full font-black text-xs">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            ONLINE ({result.latencyMs}ms)
                          </span>
                        ) : result.status === 'rate_limited' ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-full font-black text-xs">
                            <AlertTriangle size={14} />
                            COTA ESGOTADA (429)
                          </span>
                        ) : result.status === 'unconfigured' ? (
                          <span className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full font-black text-xs">
                            NÃO CONFIGURADA
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 rounded-full font-black text-xs">
                            ERRO
                          </span>
                        )
                      ) : isConfigured ? (
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-full font-black text-xs">
                          CONFIGURADA (PRONTA)
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full font-black text-xs">
                          SEM CHAVE NO RENDER
                        </span>
                      )}
                    </div>

                    {result?.error && (
                      <div className="mt-2 p-2 bg-red-500/10 rounded-lg text-[11px] font-mono text-red-600 dark:text-red-400 border border-red-500/20 truncate" title={result.error}>
                        {result.error}
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
                      <span>Modelos de Fallback:</span>
                      <span className="font-mono text-[11px]">
                        {aiConfig?.providers?.[provider]?.models?.slice(0, 2).join(', ') || 'Padrão'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 3: GUIA DE VARIÁVEIS NO RENDER */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-700 border-b-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="text-blue-500" size={20} />
              <h4 className="font-black text-lg text-slate-800 dark:text-slate-100">
                Variáveis de Ambiente no Render (Environment Variables)
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-4">
              Para garantir que o fallback automático funcione em 100% dos casos sem nunca deixar o usuário sem resposta, adicione estas variáveis no painel do seu Web Service no Render:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">GEMINI_API_KEY</span>
                  <p className="text-[10px] text-slate-400 font-sans">Chave da Google AI Studio (Gemini 2.0 / 1.5)</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded">Principal</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-orange-600 dark:text-orange-400 font-bold">GROQ_API_KEY</span>
                  <p className="text-[10px] text-slate-400 font-sans">Chave gratuita da Groq Cloud (Llama 3.3 70B)</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded">Velocidade</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">MISTRAL_API_KEY</span>
                  <p className="text-[10px] text-slate-400 font-sans">Chave da Mistral AI (Mistral Large)</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded">Backup</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">OPENAI_API_KEY</span>
                  <p className="text-[10px] text-slate-400 font-sans">Chave da OpenRouter (Multi-Model)</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded">Reserva</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color, borderColor, borderBottomColor }: any) {
  return (
    <div className={`bg-white dark:bg-slate-800 p-5 rounded-3xl border-2 ${borderColor} ${borderBottomColor} transition-all hover:scale-[1.02]`}>
      <div className={`mb-3 ${color} w-10 h-10 rounded-xl flex items-center justify-center border-2 ${borderColor}`}>
        {React.cloneElement(icon, { size: 20, strokeWidth: 2.5 })}
      </div>
      <h3 className="text-xl md:text-2xl font-black text-slate-700 dark:text-slate-100 leading-tight">{value}</h3>
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{title}</p>
    </div>
  );
}


