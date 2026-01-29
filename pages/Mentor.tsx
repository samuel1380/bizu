import React, { useState, useEffect, useRef } from 'react';
import { askBizuTutor } from '../services/gemini';
import { getChatHistory, saveChatMessage, clearChatHistory } from '../services/db';
import { ChatMessage } from '../types';
import { Send, Bot, User, Loader2, Trash2, Sparkles, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const Mentor: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getChatHistory();
        if (history.length > 0) {
          setMessages(history);
        } else {
            const welcomeMsg: ChatMessage = {
                id: 'welcome',
                role: 'model',
                text: 'Oi! Eu sou o **BizuBot**. \n\nEstou aqui para tirar dúvidas, criar resumos ou te testar. O que vamos estudar agora?',
                timestamp: new Date()
            };
            setMessages([welcomeMsg]);
        }
      } catch (e) {
        console.error("Failed to load history", e);
      } finally {
        setInitializing(false);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, initializing, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    saveChatMessage(userMsg);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await askBizuTutor(history, userMsg.text);

      // Proteção contra string vazia
      const finalText = (responseText && responseText.trim() !== "") 
        ? responseText 
        : "⚠️ Não consegui gerar uma resposta para isso. Tente perguntar de outra forma.";

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: finalText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
      await saveChatMessage(botMsg);
    } catch (error: any) {
      const errorMessage = error.message || 'Ops! Tive um problema de conexão.';
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `⚠️ **Erro:** ${errorMessage}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm("Apagar todo o histórico de conversa?")) {
        await clearChatHistory();
        const welcomeMsg: ChatMessage = {
            id: 'welcome-new',
            role: 'model',
            text: 'Tudo limpo! Sobre o que quer falar agora?',
            timestamp: new Date()
        };
        setMessages([welcomeMsg]);
    }
  };

  if (initializing) {
      return (
          <div className="h-[500px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700">
              <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
              <p className="text-slate-400 dark:text-slate-500 font-bold tracking-wide">ACORDANDO O ROBÔ...</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-slate-50 dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
           <div className="bg-blue-600 p-2.5 rounded-2xl border-b-4 border-blue-800 text-white transform hover:scale-105 transition-transform">
               <Bot size={28} strokeWidth={2.5} />
           </div>
           <div>
               <h2 className="font-black text-slate-700 dark:text-slate-100 text-lg leading-none">BizuBot</h2>
               <span className="text-xs font-bold text-green-500 uppercase tracking-wider flex items-center gap-1">
                   <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online
               </span>
           </div>
        </div>
        <button 
            onClick={handleClearChat} 
            className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
            title="Limpar conversa"
        >
            <Trash2 size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-slate-900">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full animate-in slide-in-from-bottom-2 fade-in duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {/* Avatar */}
              <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center border-2 border-b-4 ${
                msg.role === 'user' 
                    ? 'bg-blue-600 text-white border-blue-800' 
                    : 'bg-white dark:bg-slate-700 text-blue-500 dark:text-blue-400 border-slate-200 dark:border-slate-600'
              }`}>
                {msg.role === 'user' ? <User size={20} strokeWidth={3} /> : <Bot size={24} strokeWidth={3} />}
              </div>
              
              {/* Bubble */}
              <div className={`p-4 md:p-5 rounded-3xl border-2 border-b-4 text-sm md:text-base font-bold leading-relaxed relative group ${
                msg.role === 'user' 
                  ? 'bg-blue-500 border-blue-700 text-white rounded-tr-none' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-tl-none'
              }`}>
                 <ReactMarkdown 
                    components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                        strong: ({node, ...props}) => <strong className={msg.role === 'user' ? 'text-blue-100' : 'text-slate-800 dark:text-slate-100'} {...props} />,
                        code: ({node, ...props}) => <code className={`px-1 py-0.5 rounded text-xs ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'} break-all`} {...props} />
                    }}
                 >
                    {msg.text || "..."}
                 </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start w-full animate-pulse">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 text-blue-400 dark:text-blue-300 border-2 border-b-4 border-slate-200 dark:border-slate-600 flex items-center justify-center">
                  <Bot size={24} strokeWidth={2.5} />
               </div>
               <div className="bg-white dark:bg-slate-800 px-6 py-4 rounded-3xl rounded-tl-none border-2 border-b-4 border-slate-200 dark:border-slate-700 flex gap-2 items-center">
                 <span className="w-2.5 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce"></span>
                 <span className="w-2.5 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce delay-100"></span>
                 <span className="w-2.5 h-2.5 bg-slate-300 dark:bg-slate-600 rounded-full animate-bounce delay-200"></span>
               </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-white dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700">
        <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto relative">
           <div className="relative flex-grow">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="w-full pl-5 pr-12 py-4 bg-slate-100 dark:bg-slate-700 rounded-2xl border-2 border-slate-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-600 focus:border-blue-400 outline-none font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                />
                <div className="absolute right-4 inset-y-0 flex items-center text-slate-300 dark:text-slate-500 pointer-events-none">
                    <MessageSquare size={20} />
                </div>
           </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-14 md:w-16 bg-blue-600 text-white rounded-2xl border-b-4 border-blue-800 hover:bg-blue-500 active:border-b-0 active:translate-y-1 active:mt-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:mt-0 disabled:border-b-4 transition-all flex items-center justify-center"
          >
            <Send size={24} strokeWidth={3} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Mentor;