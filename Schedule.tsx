import React, { useState, useEffect } from 'react';
import { generateStudyRoutine } from '../services/gemini';
import { getStudyRoutine, saveStudyRoutine, deleteStudyRoutine } from '../services/db';
import { StudyRoutine } from '../types';
import { Calendar, Clock, BookMarked, Loader2, Sparkles, CheckCircle2, Trash2 } from 'lucide-react';

const Schedule: React.FC = () => {
  const [routine, setRoutine] = useState<StudyRoutine | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form State
  const [exam, setExam] = useState('');
  const [hours, setHours] = useState(2);
  const [subjects, setSubjects] = useState('');

  useEffect(() => {
    loadRoutine();
  }, []);

  const loadRoutine = async () => {
    setLoading(true);
    console.log("Schedule: Iniciando carregamento da rotina...");
    try {
      const savedRoutine = await getStudyRoutine();
      console.log("Schedule: Rotina recuperada do db:", savedRoutine);
      if (savedRoutine) {
        setRoutine(savedRoutine);
      } else {
        console.log("Schedule: Nenhuma rotina encontrada.");
      }
    } catch (e) {
      console.error("Schedule: Erro ao carregar rotina", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exam || !subjects) return;

    setCreating(true);
    console.log("Schedule: Criando nova rotina para:", exam);
    try {
      const newRoutine = await generateStudyRoutine(exam, hours, subjects);
      console.log("Schedule: Rotina gerada pela IA:", newRoutine);
      await saveStudyRoutine(newRoutine);
      console.log("Schedule: Rotina salva com sucesso.");
      setRoutine(newRoutine);
    } catch (e: any) {
      console.error("Schedule: Erro ao criar rotina:", e);
      alert(e.message || "Erro ao criar rotina. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Tem certeza que deseja apagar sua rotina atual?")) {
      await deleteStudyRoutine();
      setRoutine(null);
      setExam('');
      setSubjects('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  // --- No Routine State (Form) ---
  if (!routine) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-full inline-block border-2 border-yellow-200 dark:border-yellow-800/30">
             <Calendar size={48} className="text-yellow-600 dark:text-yellow-400" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-700 dark:text-slate-100">Organize sua Aprovação</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">
            Diga ao BizuBot seu objetivo e ele criará o plano perfeito.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-1">
                Qual concurso você quer passar?
              </label>
              <input 
                type="text" 
                value={exam}
                onChange={(e) => setExam(e.target.value)}
                placeholder="Ex: Polícia Federal, INSS, Banco do Brasil..."
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-600 focus:border-blue-400 focus:ring-4 focus:ring-blue-50/20 outline-none font-bold text-slate-700 dark:text-slate-200 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-1">
                Horas por dia disponíveis
              </label>
              <div className="relative">
                <div className="absolute left-5 inset-y-0 flex items-center pointer-events-none">
                  <Clock className="text-slate-400 dark:text-slate-500" size={20} />
                </div>
                <input 
                  type="number" 
                  min={1}
                  max={12}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-600 focus:border-blue-400 focus:ring-4 focus:ring-blue-50/20 outline-none font-bold text-slate-700 dark:text-slate-200 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-1">
                Quais matérias priorizar?
              </label>
              <div className="relative">
                <BookMarked className="absolute left-5 top-4 text-slate-400 dark:text-slate-500" size={20} />
                <textarea 
                  value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  placeholder="Ex: Português (prioridade), Raciocínio Lógico..."
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-600 focus:border-blue-400 focus:ring-4 focus:ring-blue-50/20 outline-none font-bold text-slate-700 dark:text-slate-200 transition-all min-h-[120px] resize-none"
                  required
                />
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
                Pode colocar só 1 matéria. O BizuBot prioriza ela e completa o resto do edital.
              </p>
            </div>

            <button 
              type="submit" 
              disabled={creating}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl border-b-4 border-blue-800 font-bold uppercase tracking-widest text-lg hover:bg-blue-500 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {creating ? (
                <>CRIANDO ROTINA <Loader2 className="animate-spin" /></>
              ) : (
                <>GERAR CRONOGRAMA <Sparkles size={20} className="fill-current" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Routine View State ---
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-blue-600 dark:bg-blue-700 rounded-3xl p-8 border-b-8 border-blue-800 dark:border-blue-900 text-white relative overflow-hidden">
        <div className="relative z-10">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tight mb-2">{routine.targetExam}</h2>
                    <p className="font-bold text-blue-100 flex items-center gap-2 opacity-90">
                        <Clock size={18} /> Meta diária: {routine.hoursPerDay}h
                    </p>
                </div>
                <button 
                    onClick={handleDelete}
                    className="p-3 bg-blue-700/50 dark:bg-slate-900/40 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl border-b-4 border-blue-900/50 dark:border-slate-950 transition-all active:border-b-0 active:translate-y-1"
                    title="Apagar Rotina"
                >
                    <Trash2 size={24} strokeWidth={2.5} />
                </button>
            </div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
            <Calendar size={200} />
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {routine.weekSchedule.map((day, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 border-b-4 flex flex-col overflow-hidden hover:translate-y-[-2px] transition-transform">
                {/* Day Header */}
                <div className={`p-4 font-black text-center uppercase tracking-wider text-white ${
                    idx === 0 ? 'bg-yellow-400 dark:bg-yellow-500' : // Segunda (Start)
                    idx === 6 ? 'bg-red-400 dark:bg-red-500' :    // Domingo (Rest/Review)
                    'bg-blue-400 dark:bg-blue-500'
                }`}>
                    {day.day}
                </div>
                
                <div className="p-5 flex-grow space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-xl border border-slate-100 dark:border-slate-600 mb-4">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Foco Principal</span>
                        <p className="font-bold text-slate-700 dark:text-slate-100 leading-tight">{day.focus}</p>
                    </div>

                    <div className="space-y-3">
                        {day.tasks.map((task, tIdx) => (
                            <div key={tIdx} className="flex items-start gap-3 group cursor-pointer">
                                <div className="mt-1 text-slate-300 dark:text-slate-600 group-hover:text-green-500 transition-colors">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{task.subject}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{task.activity} • {task.duration}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default Schedule;
