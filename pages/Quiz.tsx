import React, { useState, useEffect } from 'react';
import { generateQuizQuestions } from '../services/gemini';
import { saveQuizResult } from '../services/db';
import { Question, Difficulty, QuizConfig } from '../types';
import { Brain, Check, X, RefreshCw, Loader2, AlertCircle, Play, Flag } from 'lucide-react';

const Quiz: React.FC = () => {
  const [config, setConfig] = useState<QuizConfig>({
    topic: '',
    difficulty: Difficulty.MEDIUM,
    numberOfQuestions: 5,
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingResult, setSavingResult] = useState(false);
  const [isChecked, setIsChecked] = useState(false); // New state to control feedback view
  const [estimatedSeconds, setEstimatedSeconds] = useState(0);

  // Timer effect for the loading screen
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading && estimatedSeconds > 0) {
      interval = setInterval(() => {
        setEstimatedSeconds(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loading, estimatedSeconds]);

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.topic) return;

    // Calcular tempo estimado (aprox. 1.5s por questão devido ao processamento em lote)
    const totalSeconds = Math.ceil(config.numberOfQuestions * 1.5);
    setEstimatedSeconds(totalSeconds);
    
    setLoading(true);
    setError(null);
    try {
      const generatedQuestions = await generateQuizQuestions(config);
      setQuestions(generatedQuestions);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setShowResults(false);
      setIsChecked(false);
    } catch (err: any) {
      // Show specific error from backend (e.g., Rate Limit or Safety)
      setError(err.message || "Falha ao gerar o quiz. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (isChecked) return; // Prevent changing answer after checking
    const currentQ = questions[currentQuestionIndex];
    setUserAnswers(prev => ({ ...prev, [currentQ.id]: optionIndex }));
  };

  const handleCheck = () => {
    setIsChecked(true);
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswerIndex) score++;
    });
    return score;
  };

  const handleFinish = async () => {
    setSavingResult(true);
    const score = calculateScore();
    try {
      await saveQuizResult(config.topic, questions.length, score);
    } catch (err) {
      console.error("Failed to save result", err);
    } finally {
      setSavingResult(false);
      setShowResults(true);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setIsChecked(false);
    } else {
      handleFinish();
    }
  };

  const handleExitQuiz = () => {
    setQuestions([]);
    setShowResults(false);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setIsChecked(false);
    setError(null);
    setSavingResult(false);
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Configuration Screen ---
  if (questions.length === 0 && !loading) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-blue-100 text-blue-600 rounded-2xl border-2 border-blue-200 mb-4">
              <Brain size={48} strokeWidth={2} />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-700">Simulado Personalizado</h2>
            <p className="text-slate-500 font-medium mt-2">Escolha o tema e a IA cria o desafio.</p>
          </div>

          <form onSubmit={handleStartQuiz} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Assunto</label>
              <input
                type="text"
                required
                value={config.topic}
                onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                placeholder="Ex: Crase, Licitações..."
                className="w-full px-5 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 focus:bg-white focus:border-blue-400 focus:ring-0 transition-colors outline-none font-bold text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Nível</label>
                <select
                  value={config.difficulty}
                  onChange={(e) => setConfig({ ...config, difficulty: e.target.value as Difficulty })}
                  className="w-full appearance-none px-5 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 focus:bg-white focus:border-blue-400 outline-none font-bold text-slate-700 cursor-pointer"
                >
                  {Object.values(Difficulty).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Questões</label>
                <select
                  value={config.numberOfQuestions}
                  onChange={(e) => setConfig({ ...config, numberOfQuestions: Number(e.target.value) })}
                  className="w-full appearance-none px-5 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 focus:bg-white focus:border-blue-400 outline-none font-bold text-slate-700 cursor-pointer"
                >
                  <option value={5}>5 (Rápido)</option>
                  <option value={10}>10 (Padrão)</option>
                  <option value={20}>20 (Intenso)</option>
                  <option value={50}>50 (Simulado)</option>
                  <option value={100}>100 (Maratona)</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-100 text-red-600 rounded-2xl border-2 border-red-200 flex items-center gap-3 font-bold animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={20} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white border-b-4 border-blue-800 rounded-2xl font-bold text-lg py-4 hover:bg-blue-500 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              COMEÇAR <Play size={24} strokeWidth={3} className="fill-current" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Loading Screen ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="relative mb-8">
          <Loader2 size={80} className="animate-spin text-blue-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain size={32} className="text-blue-300 animate-pulse" />
          </div>
        </div>
        
        <h3 className="text-3xl font-black text-slate-700 mb-4 uppercase tracking-tight">Preparando seu Simulado</h3>
        
        <div className="bg-slate-100 px-8 py-6 rounded-2xl border-2 border-slate-200 mb-6">
          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mb-2">Tempo Estimado</p>
          <div className="text-4xl font-black text-blue-600 font-mono">
            {formatTime(estimatedSeconds)}
          </div>
        </div>

        <p className="text-slate-400 font-bold max-w-sm">
          A IA do BizuBot está gerando {config.numberOfQuestions} questões inéditas para você. Não feche esta página!
        </p>

        <div className="mt-8 flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-3 h-3 bg-blue-200 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // --- Results Screen ---
  if (showResults) {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);
    const isGoodScore = percentage >= 70;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-8 text-center">
            <div className={`inline-flex p-4 rounded-full mb-6 ${isGoodScore ? 'bg-yellow-100 text-yellow-500' : 'bg-blue-100 text-blue-500'}`}>
                {isGoodScore ? <Flag size={64} className="fill-current" /> : <Brain size={64} />}
            </div>
            
            <h2 className={`text-4xl font-black mb-2 ${isGoodScore ? 'text-yellow-500' : 'text-blue-500'}`}>
                {isGoodScore ? 'EXCELENTE!' : 'BOM TREINO!'}
            </h2>
            
            <p className="text-slate-400 font-bold text-xl mb-8">
                Você acertou {score} de {questions.length}
            </p>

            <div className="grid grid-cols-1 gap-4 text-left">
                {questions.map((q, idx) => {
                    const userAnswer = userAnswers[q.id];
                    const isCorrect = userAnswer === q.correctAnswerIndex;
                    return (
                        <div key={q.id} className={`p-4 rounded-2xl border-2 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex gap-2 font-bold text-slate-700 mb-1">
                                <span>{idx + 1}.</span>
                                <span>{q.text}</span>
                            </div>
                            {!isCorrect && (
                                <p className="text-sm text-red-500 font-bold ml-5">
                                    Correta: {q.options[q.correctAnswerIndex]}
                                </p>
                            )}
                        </div>
                    )
                })}
            </div>

            <button
              onClick={() => {
                setQuestions([]);
                setShowResults(false);
                setConfig(prev => ({ ...prev, topic: '' }));
              }}
              className="mt-8 bg-blue-600 text-white border-b-4 border-blue-800 px-10 py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-blue-500 active:border-b-0 active:translate-y-1 transition-all"
            >
              CONTINUAR
            </button>
        </div>
      </div>
    );
  }

  // --- Active Question Screen ---
  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-8 text-center">
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Erro ao carregar questões</h2>
          <p className="text-slate-500 mb-6">Não conseguimos carregar as questões deste quiz.</p>
          <button onClick={handleExitQuiz} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold uppercase">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIndex];
  
  if (!currentQ) {
    return (
      <div className="max-w-2xl mx-auto py-8 text-center">
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-sm">
          <Loader2 size={48} className="animate-spin text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700">Carregando questão...</h2>
          <button onClick={handleExitQuiz} className="mt-4 text-blue-600 font-bold">Cancelar</button>
        </div>
      </div>
    );
  }

  const selectedOption = userAnswers[currentQ.id];
  const hasSelected = selectedOption !== undefined;
  
  // Logic for feedback colors
  const isCorrect = selectedOption === currentQ.correctAnswerIndex;

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Progress Bar */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={handleExitQuiz} className="text-slate-300 hover:text-slate-500">
            <X size={28} strokeWidth={3} />
        </button>
        <div className="h-4 flex-grow bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentQuestionIndex + (isChecked ? 0.5 : 0)) / questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="mb-24"> {/* Extra margin for bottom bar */}
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-700 mb-8 leading-snug">
          {currentQ.text}
        </h2>

        <div className="space-y-4">
          {currentQ.options.map((option, idx) => {
            // Styling logic for buttons
            let baseStyle = "w-full text-left p-5 rounded-2xl border-2 border-b-4 font-bold text-lg transition-all active:border-b-2 active:translate-y-[2px] ";
            let statusStyle = "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"; // Default
            
            if (hasSelected && selectedOption === idx) {
                // User selected this one (keep as Blue for selection)
                statusStyle = "bg-blue-100 border-blue-300 text-blue-600 border-b-4 border-blue-500";
            }
            
            if (isChecked) {
                if (idx === currentQ.correctAnswerIndex) {
                    statusStyle = "bg-green-100 border-green-500 text-green-600"; // Show correct
                } else if (selectedOption === idx && !isCorrect) {
                     statusStyle = "bg-red-100 border-red-500 text-red-600"; // Show wrong selection
                } else {
                    statusStyle = "bg-white border-slate-200 text-slate-300 opacity-50"; // Fade others
                }
            }

            return (
                <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={isChecked}
                className={baseStyle + statusStyle}
                >
                <div className="flex items-center gap-4">
                    <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border-2 font-black text-sm ${
                        isChecked && idx === currentQ.correctAnswerIndex ? 'bg-green-500 border-green-600 text-white' : 
                        isChecked && selectedOption === idx && !isCorrect ? 'bg-red-500 border-red-600 text-white' :
                        selectedOption === idx ? 'bg-blue-500 border-blue-600 text-white' : 
                        'bg-white border-slate-200 text-slate-400'
                    }`}>
                        {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                </div>
                </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className={`fixed bottom-0 left-0 w-full border-t-2 border-slate-200 p-4 md:p-8 transition-colors ${
          isChecked 
            ? (isCorrect ? 'bg-green-100 border-green-200' : 'bg-red-100 border-red-200')
            : 'bg-white'
      }`}>
         <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            {isChecked && (
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className={`p-3 rounded-full ${isCorrect ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                        {isCorrect ? <Check size={24} strokeWidth={4} /> : <X size={24} strokeWidth={4} />}
                    </div>
                    <div>
                        <h4 className={`text-xl font-black ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {isCorrect ? 'Correto!' : 'Incorreto'}
                        </h4>
                        {!isCorrect && <p className="text-red-500 font-bold text-sm">Resposta correta: {currentQ.options[currentQ.correctAnswerIndex]}</p>}
                    </div>
                </div>
            )}
            
            <div className="ml-auto w-full md:w-auto">
                {!isChecked ? (
                    <button
                        onClick={handleCheck}
                        disabled={!hasSelected}
                        className={`w-full md:w-48 px-8 py-3 rounded-2xl font-bold uppercase tracking-widest border-b-4 transition-all ${
                            hasSelected 
                            ? 'bg-blue-600 text-white border-blue-800 hover:bg-blue-500 active:border-b-0 active:translate-y-1' 
                            : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                        }`}
                    >
                        VERIFICAR
                    </button>
                ) : (
                    <button
                        onClick={handleNext}
                        className={`w-full md:w-48 px-8 py-3 rounded-2xl font-bold uppercase tracking-widest border-b-4 transition-all active:border-b-0 active:translate-y-1 ${
                            isCorrect 
                            ? 'bg-blue-600 text-white border-blue-800 hover:bg-blue-500'
                            : 'bg-red-500 text-white border-red-700 hover:bg-red-400'
                        }`}
                    >
                         {savingResult ? <Loader2 className="animate-spin mx-auto" /> : 'CONTINUAR'}
                    </button>
                )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Quiz;
