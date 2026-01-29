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
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface SalesEvent {
  id: string;
  email: string;
  event_type: string;
  created_at: string;
  raw_data: any;
}

export default function Admin() {
  const [events, setEvents] = useState<SalesEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
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

  useEffect(() => {
    fetchEvents();
  }, []);

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
    } finally {
      setLoading(false);
    }
  }

  function calculateDetailedStats(data: SalesEvent[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const isSuccess = (type: string) => ['order_completed', 'approved', 'subscription_renewed'].includes(type);
    
    let totalSales = 0;
    let salesToday = 0;
    let salesMonth = 0;
    let revenueTotal = 0;
    let revenueMonth = 0;
    let abandonedCarts = 0;
    
    data.forEach(event => {
      const eventDate = new Date(event.created_at);
      const price = event.raw_data?.data?.price || event.raw_data?.price || 97; // Valor padrão se não vier no webhook

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

      if (event.event_type.includes('abandoned') || event.event_type.includes('cart') || event.event_type === 'lead') {
        abandonedCarts++;
      }
    });

    const leads = new Set(data.map(e => e.email)).size;
    
    setStats({
      totalSales,
      salesToday,
      salesMonth,
      revenueTotal,
      revenueMonth,
      activeSubscriptions: totalSales, // Simplificado
      abandonedCarts,
      totalLeads: leads
    });
  }

  const getEventBadge = (type: string) => {
    const success = ['order_completed', 'approved', 'subscription_renewed', 'subscription_active'];
    const danger = ['subscription_cancelled', 'refunded', 'expired', 'chargeback'];
    
    if (success.includes(type)) return 'bg-green-500 text-white border-green-700';
    if (danger.includes(type)) return 'bg-red-500 text-white border-red-700';
    return 'bg-blue-500 text-white border-blue-700';
  };

  const filteredEvents = events.filter(e => 
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.event_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold">Carregando Dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 px-4 pt-4 bg-slate-50 min-h-screen">
      
      {/* Header com Visual do App */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
            <Link to="/" className="flex items-center gap-2 text-blue-600 font-black mb-2 hover:underline">
              <ArrowLeft size={18} /> VOLTAR AO APP
            </Link>
            <h1 className="text-3xl font-black text-slate-700 tracking-tight">
                Dashboard de Vendas 💰
            </h1>
            <p className="text-slate-400 font-bold">Métricas detalhadas do seu negócio</p>
        </div>
        
        <div className="flex gap-3">
            <button onClick={fetchEvents} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl border-b-4 border-blue-700 hover:bg-blue-600 transition-all font-black text-sm">
                ATUALIZAR DADOS
            </button>
        </div>
      </div>

      {/* Grid de Faturamento e Vendas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <StatCard title="Vendas Hoje" value={stats.salesToday} icon={<Zap />} color="bg-yellow-100 text-yellow-600" borderColor="border-yellow-200" borderBottomColor="border-b-yellow-400" />
            <StatCard title="Vendas Mês" value={stats.salesMonth} icon={<TrendingUp />} color="bg-green-100 text-green-600" borderColor="border-green-200" borderBottomColor="border-b-green-400" />
            <StatCard title="Faturamento Mês" value={`R$ ${stats.revenueMonth.toLocaleString()}`} icon={<DollarSign />} color="bg-blue-100 text-blue-600" borderColor="border-blue-200" borderBottomColor="border-b-blue-400" />
            <StatCard title="Faturamento Total" value={`R$ ${stats.revenueTotal.toLocaleString()}`} icon={<ArrowUpRight />} color="bg-purple-100 text-purple-600" borderColor="border-purple-200" borderBottomColor="border-b-purple-400" />
        </div>
        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 border-b-8 flex flex-col justify-center text-center">
            <div className="mx-auto mb-4 bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center border-2 border-blue-200">
                <Users className="text-blue-600" size={32} />
            </div>
            <h3 className="text-4xl font-black text-slate-700">{stats.totalLeads}</h3>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Leads Totais</p>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2">
                <div>
                    <p className="text-2xl font-black text-slate-700">{stats.activeSubscriptions}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Ativos</p>
                </div>
                <div>
                    <p className="text-2xl font-black text-slate-700">{stats.abandonedCarts}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Abandonos</p>
                </div>
            </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por e-mail, evento ou status..."
          className="w-full pl-12 pr-4 py-4 bg-white border-2 border-b-4 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 transition-all font-bold text-slate-600 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabela de Atividades Detalhada */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-700 flex items-center gap-2 px-2">
            <Clock className="text-blue-500" />
            Histórico Detalhado
        </h3>

        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-2xl border-2 border-slate-200 border-b-4 overflow-hidden transition-all group">
              <div 
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${getEventBadge(event.event_type).includes('green') ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                    <Mail className={getEventBadge(event.event_type).includes('green') ? 'text-green-600' : 'text-slate-400'} size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-700 leading-tight">
                      {event.email}
                    </h4>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">
                      <Calendar size={12} />
                      {new Date(event.created_at).toLocaleString('pt-BR')}
                      <span className="mx-1">•</span>
                      <span>{event.raw_data?.data?.offer_name || event.raw_data?.offer_name || 'Bizu App'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide border-2 ${getEventBadge(event.event_type)}`}>
                    {event.event_type.replace(/_/g, ' ')}
                  </span>
                  <div className="text-slate-400">
                    {selectedEvent === event.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </div>

              {/* Detalhes do Webhook (JSON) */}
              {selectedEvent === event.id && (
                <div className="p-4 bg-slate-900 text-blue-300 font-mono text-xs overflow-x-auto border-t-2 border-slate-200">
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
            <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 font-bold italic">Nenhum evento encontrado para esta busca.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, borderColor, borderBottomColor }: any) {
  return (
    <div className={`bg-white p-5 rounded-3xl border-2 ${borderColor} ${borderBottomColor} transition-all hover:scale-[1.02]`}>
        <div className={`mb-3 ${color} w-10 h-10 rounded-xl flex items-center justify-center border-2 ${borderColor}`}>
            {React.cloneElement(icon, { size: 20, strokeWidth: 2.5 })}
        </div>
        <h3 className="text-xl md:text-2xl font-black text-slate-700 leading-tight">{value}</h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{title}</p>
    </div>
  );
}


