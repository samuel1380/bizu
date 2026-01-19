import React, { useState, useEffect } from 'react';
import { StudyMaterial } from '../types';
import { generateStudyMaterials, generateMaterialContent } from '../services/gemini';
import { getAllMaterials, saveMaterialsBatch, saveMaterial } from '../services/db';
import { FileText, Book, Search, Loader2, X, Sparkles, Printer } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const Materials: React.FC = () => {
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  
  // Modal states
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [generatingContent, setGeneratingContent] = useState(false);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      let storedMaterials = await getAllMaterials();
      if (storedMaterials.length === 0) {
        setGenerating(true);
        const newMaterials = await generateStudyMaterials(4);
        await saveMaterialsBatch(newMaterials);
        storedMaterials = newMaterials;
        setGenerating(false);
      }
      setMaterials(storedMaterials.reverse());
    } catch (error) {
      console.error("Failed to load materials", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMore = async () => {
    setGenerating(true);
    try {
      const newMaterials = await generateStudyMaterials(3);
      await saveMaterialsBatch(newMaterials);
      setMaterials(prev => [...newMaterials, ...prev]);
    } catch (error) {
      console.error("Error generating more materials", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenMaterial = (material: StudyMaterial) => {
    setSelectedMaterial(material);
  };

  const handleCloseModal = () => {
    setSelectedMaterial(null);
  };

  const handleGenerateContent = async () => {
    if (!selectedMaterial) return;
    
    setGeneratingContent(true);
    try {
      const content = await generateMaterialContent(selectedMaterial);
      const updatedMaterial = { ...selectedMaterial, content };
      await saveMaterial(updatedMaterial);
      setMaterials(prev => prev.map(m => m.id === updatedMaterial.id ? updatedMaterial : m));
      setSelectedMaterial(updatedMaterial);
    } catch (error) {
      console.error("Failed to generate content", error);
    } finally {
      setGeneratingContent(false);
    }
  };

  const handlePrintPDF = () => {
    // Abre a caixa de diálogo de impressão do navegador para salvar como PDF
    window.print();
  };

  const categories = ['Todos', ...Array.from(new Set(materials.map(m => m.category)))];

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.summary && m.summary.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'Todos' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getIcon = (type: StudyMaterial['type']) => {
    switch (type) {
      case 'PDF': return <FileText size={24} className="text-red-500" strokeWidth={2.5} />;
      case 'ARTICLE': return <Book size={24} className="text-blue-500" strokeWidth={2.5} />;
      default: return <FileText size={24} className="text-slate-500" strokeWidth={2.5} />;
    }
  };

  return (
    <div className="space-y-6 relative print:hidden">
      {/* Esconde a interface principal na hora de imprimir, mostrando apenas o modal */}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-700">Apostilas & Resumos</h1>
          <p className="text-slate-400 font-bold">PDFs e Artigos gerados via IA.</p>
        </div>
        
        <button 
          onClick={handleGenerateMore} 
          disabled={generating}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl border-b-4 border-blue-800 font-bold uppercase tracking-wider hover:bg-blue-500 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg"
        >
            {generating ? (
              <>CRIANDO... <Loader2 size={18} className="animate-spin" /></>
            ) : (
              <>+ GERAR MATERIAL</>
            )}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 flex flex-col md:flex-row gap-2">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} strokeWidth={3} />
          <input
            type="text"
            placeholder="Buscar material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-transparent bg-slate-100 focus:bg-white focus:border-blue-400 outline-none font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-bold"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto p-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-4 transition-all active:border-b-0 active:translate-y-1 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white border-blue-800'
                  : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading && materials.length === 0 ? (
        <div className="text-center py-20">
             <Loader2 size={48} className="animate-spin text-blue-400 mx-auto mb-4" />
             <p className="text-slate-400 font-bold">GERANDO BIBLIOTECA...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((material) => (
            <div 
              key={material.id} 
              onClick={() => handleOpenMaterial(material)}
              className="bg-white rounded-2xl border-2 border-slate-200 border-b-4 p-5 cursor-pointer hover:bg-slate-50 active:border-b-2 active:translate-y-[2px] transition-all group flex flex-col h-full shadow-sm hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-slate-100 rounded-xl">
                  {getIcon(material.type)}
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${
                   material.type === 'PDF' ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'
                }`}>
                  {material.type}
                </span>
              </div>
              
              <h3 className="font-extrabold text-lg text-slate-700 mb-2 leading-tight">
                {material.title}
              </h3>

              {material.summary && (
                <p className="text-sm text-slate-400 font-medium mb-4 line-clamp-3 flex-grow">
                    {material.summary}
                </p>
              )}
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t-2 border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase">{material.category}</span>
                <span className="text-xs font-bold text-slate-400">{material.duration || '5 pág'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Document Viewer */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:bg-white print:static print:p-0">
          <div className="bg-white rounded-none md:rounded-3xl w-full max-w-4xl h-full md:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 md:border-b-8 md:border-slate-300 print:border-none print:shadow-none print:max-w-none print:max-h-none">
            
            {/* Header (Hidden on Print) */}
            <div className="flex items-start justify-between p-6 border-b-2 border-slate-100 bg-white print:hidden">
              <div className="pr-8">
                <h2 className="text-2xl font-black text-slate-700 leading-tight">{selectedMaterial.title}</h2>
                <div className="flex gap-2 mt-2">
                     <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-lg uppercase tracking-wide">
                        {selectedMaterial.type}
                     </span>
                     <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-lg uppercase tracking-wide">
                        {selectedMaterial.category}
                     </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {selectedMaterial.content && (
                    <button 
                        onClick={handlePrintPDF}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors hidden md:block"
                        title="Salvar como PDF / Imprimir"
                    >
                        <Printer size={24} strokeWidth={2.5} />
                    </button>
                 )}
                 <button 
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                 >
                    <X size={28} strokeWidth={3} />
                 </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-4 md:p-12 bg-slate-50 print:bg-white print:p-0 print:overflow-visible">
              {selectedMaterial.content ? (
                <div className="prose prose-slate prose-lg max-w-none bg-white p-8 md:p-12 rounded-2xl border-2 border-slate-200 print:border-none print:shadow-none print:p-0">
                   {/* Cabeçalho visível apenas no print para dar contexto */}
                   <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                        <h1 className="text-3xl font-black">{selectedMaterial.title}</h1>
                        <p className="text-slate-600">Material gerado pelo Bizu App</p>
                   </div>
                   <ReactMarkdown>{selectedMaterial.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center print:hidden">
                   <div className="mb-6 text-slate-300">
                      <Sparkles size={64} />
                   </div>
                   <h3 className="text-2xl font-black text-slate-700 mb-2">Apostila ainda não criada</h3>
                   <p className="text-slate-400 font-bold mb-8 max-w-md">
                     O BizuBot vai escrever uma apostila completa em PDF sobre este tema agora.
                   </p>

                   <button
                    onClick={handleGenerateContent}
                    disabled={generatingContent}
                    className="bg-blue-600 text-white px-8 py-4 rounded-2xl border-b-4 border-blue-800 font-bold uppercase tracking-widest hover:bg-blue-500 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-xl"
                   >
                     {generatingContent ? (
                        <>ESCREVENDO APOSTILA... <Loader2 className="animate-spin" /></>
                     ) : (
                        <>CRIAR APOSTILA AGORA</>
                     )}
                   </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Estilos Globais de Impressão */}
      <style>{`
        @media print {
            body * {
                visibility: hidden;
            }
            .fixed.inset-0, .fixed.inset-0 * {
                visibility: visible;
            }
            .fixed.inset-0 {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background: white;
                padding: 0;
            }
            /* Esconde botões na impressão */
            button, .print\\:hidden {
                display: none !important;
            }
        }
      `}</style>
    </div>
  );
};

export default Materials;
