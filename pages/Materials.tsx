import React, { useState, useEffect } from 'react';
import { StudyMaterial } from '../types';
import { generateStudyMaterials, generateMaterialContent, createCustomMaterial } from '../services/gemini';
import { getAllMaterials, saveMaterialsBatch, saveMaterial, clearAllMaterials } from '../services/db';
import { FileText, Book, Search, Loader2, X, Sparkles, Printer, Download, PlusCircle, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Função para injetar o script do html2pdf.js dinamicamente
const loadHtml2Pdf = () => {
  return new Promise((resolve, reject) => {
    if ((window as any).html2pdf) {
      resolve((window as any).html2pdf);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve((window as any).html2pdf);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const Materials: React.FC = () => {
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  
  // Modal states
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Custom Material Form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [creatingCustom, setCreatingCustom] = useState(false);

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

  const handleClearAll = async () => {
    if (materials.length === 0) return;
    if (window.confirm("Apagar todas as apostilas e resumos? Esta ação não pode ser desfeita.")) {
      try {
        await clearAllMaterials();
        setMaterials([]);
      } catch (error) {
        console.error("Erro ao apagar materiais:", error);
        alert("Falha ao apagar materiais.");
      }
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim()) return;

    setCreatingCustom(true);
    try {
      const newMaterial = await createCustomMaterial(customTopic);
      await saveMaterial(newMaterial);
      setMaterials(prev => [newMaterial, ...prev]);
      setCustomTopic('');
      setShowCustomForm(false);
      // Opcional: abrir o material criado imediatamente
      handleOpenMaterial(newMaterial);
    } catch (error) {
      console.error("Erro ao criar material personalizado:", error);
      alert("Falha ao criar material. Tente novamente.");
    } finally {
      setCreatingCustom(false);
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
    // Título do documento para o nome do arquivo ao salvar PDF
    const originalTitle = document.title;
    document.title = `Bizu_Apostila_${selectedMaterial?.title.replace(/\s+/g, '_')}`;
    window.print();
    document.title = originalTitle;
  };

  const handleDownloadPDF = async () => {
    if (!selectedMaterial || !selectedMaterial.content) return;
    
    setDownloadingPDF(true);
    try {
      const html2pdf = (await loadHtml2Pdf()) as any;
      
      // Captura o conteúdo Markdown renderizado do elemento específico
      const contentElement = document.getElementById('material-content-view');
      const proseContent = contentElement?.querySelector('.prose')?.innerHTML || '';
      
      if (!proseContent) {
        throw new Error("Não foi possível capturar o conteúdo para o PDF.");
      }
      
      // Cria um elemento temporário para o PDF com estilos embutidos para garantir consistência
      const element = document.createElement('div');
      element.style.width = '100%';
      element.innerHTML = `
        <style>
          .pdf-container {
            padding: 40px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #1e293b;
            line-height: 1.6;
            background: white;
          }
          .pdf-header {
            border-bottom: 5px solid #2563eb;
            margin-bottom: 40px;
            padding-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .pdf-header-text h1 {
            font-size: 36px;
            font-weight: 900;
            margin: 0;
            color: #0f172a;
            line-height: 1.1;
            text-transform: uppercase;
          }
          .pdf-header-text p {
            color: #2563eb;
            font-weight: 800;
            margin: 8px 0 0 0;
            font-size: 14px;
            letter-spacing: 0.1em;
          }
          .pdf-content {
            font-size: 15px;
            color: #334155;
          }
          /* Estilização básica para simular o 'prose' do Tailwind */
          .pdf-content h1 { font-size: 28px; font-weight: 900; margin-top: 35px; margin-bottom: 20px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .pdf-content h2 { font-size: 22px; font-weight: 800; margin-top: 30px; margin-bottom: 15px; color: #1e293b; display: flex; align-items: center; }
          .pdf-content h3 { font-size: 19px; font-weight: 700; margin-top: 25px; margin-bottom: 12px; color: #334155; }
          .pdf-content p { margin-bottom: 15px; text-align: justify; }
          .pdf-content ul, .pdf-content ol { margin-bottom: 20px; padding-left: 25px; }
          .pdf-content li { margin-bottom: 8px; }
          .pdf-content blockquote { 
            border-left: 6px solid #2563eb; 
            background: #f8fafc; 
            padding: 15px 25px; 
            margin: 25px 0; 
            font-style: italic;
            border-radius: 4px;
            color: #1e293b;
          }
          .pdf-content table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 30px 0; 
            font-size: 13px; 
            table-layout: auto;
          }
          .pdf-content th { 
            background: #2563eb; 
            text-align: left; 
            padding: 12px; 
            border: 1px solid #1e40af; 
            font-weight: 800; 
            color: white; 
          }
          .pdf-content td { 
            padding: 12px; 
            border: 1px solid #e2e8f0; 
            background: white; 
            vertical-align: top;
          }
          .pdf-content tr:nth-child(even) td { background: #f8fafc; }
          .pdf-content strong { color: #0f172a; font-weight: 800; }
          .pdf-footer {
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #f1f5f9;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            font-weight: 700;
            letter-spacing: 0.05em;
          }
          /* Forçar quebras de página */
          h1, h2, h3 { page-break-after: avoid; }
          blockquote, table, pre { page-break-inside: avoid; }
        </style>
        <div class="pdf-container">
          <div class="pdf-header">
            <div class="pdf-header-text">
              <h1>${selectedMaterial.title}</h1>
              <p>BIZU APP • MATERIAL DE ESTUDO EXCLUSIVO</p>
            </div>
          </div>
          <div class="pdf-content">
            ${proseContent}
          </div>
          <div class="pdf-footer">
            ESTE MATERIAL É PARTE INTEGRANTE DO ECOSSISTEMA BIZU • © ${new Date().getFullYear()} • PROIBIDA REPRODUÇÃO
          </div>
        </div>
      `;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Bizu_Apostila_${selectedMaterial.title.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollY: 0,
          windowWidth: 800
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      document.body.appendChild(element);
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.top = '0';
      element.style.width = '800px';

      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      alert(error.message || "Erro ao gerar PDF. Tente usar o botão de Imprimir.");
    } finally {
      setDownloadingPDF(false);
    }
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
    <div className="space-y-6 relative no-print">
      {/* Esconde a interface principal na hora de imprimir, mostrando apenas o modal */}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-700 dark:text-slate-100">Apostilas & Resumos</h1>
            <p className="text-slate-400 dark:text-slate-500 font-bold">PDFs e Artigos gerados via IA.</p>
          </div>
          {materials.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="p-3 bg-slate-100 dark:bg-slate-800 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl border-b-4 border-slate-200 dark:border-slate-900 transition-all active:border-b-0 active:translate-y-1"
              title="Apagar tudo"
            >
              <Trash2 size={24} strokeWidth={2.5} />
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCustomForm(true)} 
            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl border-b-4 border-emerald-800 font-bold uppercase tracking-wider hover:bg-emerald-500 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 shadow-lg"
          >
            <PlusCircle size={20} />
            <span className="hidden sm:inline">PEDIR APOSTILA</span>
            <span className="sm:hidden">PEDIR</span>
          </button>

          <button 
            onClick={handleGenerateMore} 
            disabled={generating}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl border-b-4 border-blue-800 font-bold uppercase tracking-wider hover:bg-blue-500 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg"
          >
              {generating ? (
                <>CRIANDO... <Loader2 size={18} className="animate-spin" /></>
              ) : (
                <>+ SUGERIR</>
              )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-2">
        <div className="relative flex-grow">
          <div className="absolute left-4 inset-y-0 flex items-center pointer-events-none">
            <Search className="text-slate-400 dark:text-slate-500" size={20} strokeWidth={3} />
          </div>
          <input
            type="text"
            placeholder="Buscar material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-transparent bg-slate-100 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 focus:border-blue-400 outline-none font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-bold"
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
                  : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {showCustomForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b-2 border-slate-100 dark:border-slate-700 flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <PlusCircle size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-700 dark:text-slate-100 uppercase tracking-tight">Pedir Apostila</h3>
              </div>
              <button onClick={() => setShowCustomForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X size={24} strokeWidth={3} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCustom} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 ml-1">
                  Qual o tema ou assunto do material?
                </label>
                <textarea
                  required
                  rows={4}
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Ex: Português - Pontuação: Uso do ponto e vírgula, dois-pontos e travessão..."
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-600 focus:border-emerald-500 focus:ring-0 transition-all outline-none font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500 resize-none"
                />
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
                  Dica: Você pode copiar e colar uma tarefa da sua <span className="text-blue-500">Rotina de Estudos</span> aqui para gerar o material exato que precisa!
                </p>
              </div>

              <button
                type="submit"
                disabled={creatingCustom}
                className="w-full bg-emerald-600 text-white border-b-4 border-emerald-800 rounded-2xl font-black text-lg py-4 hover:bg-emerald-500 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creatingCustom ? (
                  <>CRIANDO ESTRUTURA... <Loader2 size={24} className="animate-spin" /></>
                ) : (
                  <>GERAR MATERIAL AGORA</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading && materials.length === 0 ? (
        <div className="text-center py-20">
             <Loader2 size={48} className="animate-spin text-blue-400 mx-auto mb-4" />
             <p className="text-slate-400 dark:text-slate-500 font-bold">GERANDO BIBLIOTECA...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((material) => (
            <div 
              key={material.id} 
              onClick={() => handleOpenMaterial(material)}
              className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-4 p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 active:border-b-2 active:translate-y-[2px] transition-all group flex flex-col h-full shadow-sm hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-xl">
                  {getIcon(material.type)}
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wide ${
                   material.type === 'PDF' ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400'
                }`}>
                  {material.type}
                </span>
              </div>
              
              <h3 className="font-extrabold text-lg text-slate-700 dark:text-slate-100 mb-2 leading-tight">
                {material.title}
              </h3>

              {material.summary && (
                <p className="text-sm text-slate-400 dark:text-slate-500 font-medium mb-4 line-clamp-3 flex-grow">
                    {material.summary}
                </p>
              )}
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t-2 border-slate-100 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{material.category}</span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{material.duration || '5 pág'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Document Viewer */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:bg-white print:static print:p-0 print-content">
          <div className="bg-white dark:bg-slate-800 rounded-none md:rounded-3xl w-full max-w-4xl h-full md:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 md:border-b-8 md:border-slate-300 dark:md:border-slate-900 print:border-none print:shadow-none print:max-w-none print:max-h-none">
            
            {/* Header (Hidden on Print) */}
            <div className="flex items-start justify-between p-6 border-b-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 no-print">
              <div className="pr-8">
                <h2 className="text-2xl font-black text-slate-700 dark:text-slate-100 leading-tight">{selectedMaterial.title}</h2>
                <div className="flex gap-2 mt-2">
                     <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-lg uppercase tracking-wide">
                        {selectedMaterial.type}
                     </span>
                     <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-3 py-1 rounded-lg uppercase tracking-wide">
                        {selectedMaterial.category}
                     </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 {selectedMaterial.content && (
                    <>
                      <button 
                          onClick={handleDownloadPDF}
                          disabled={downloadingPDF}
                          className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors flex items-center gap-2"
                          title="Baixar PDF Direto"
                      >
                          {downloadingPDF ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} strokeWidth={2.5} />}
                          <span className="hidden md:block font-bold text-sm">BAIXAR PDF</span>
                      </button>
                      <button 
                          onClick={handlePrintPDF}
                          className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors hidden md:block"
                          title="Salvar como PDF / Imprimir"
                      >
                          <Printer size={24} strokeWidth={2.5} />
                      </button>
                    </>
                 )}
                 <button 
                    onClick={handleCloseModal}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 rounded-xl transition-colors"
                 >
                    <X size={28} strokeWidth={3} />
                 </button>
              </div>
            </div>

            {/* Content Area */}
            <div id="material-content-view" className="flex-grow overflow-y-auto p-4 md:p-12 bg-slate-50 dark:bg-slate-900 print:bg-white print:p-0 print:overflow-visible">
              {selectedMaterial.content ? (
                <div className="prose dark:prose-invert prose-slate prose-lg max-w-none bg-white dark:bg-slate-800 p-8 md:p-12 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm print:border-none print:shadow-none print:p-0">
                   {/* Cabeçalho visível apenas no print para dar contexto */}
                   <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                        <h1 className="text-3xl font-black">{selectedMaterial.title}</h1>
                        <p className="text-slate-600">Material gerado pelo Bizu App</p>
                   </div>
                   <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-8 border-2 border-slate-100 dark:border-slate-700 rounded-xl">
                          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700" {...props} />
                        </div>
                      ),
                      th: ({node, ...props}) => (
                        <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b-2 border-slate-200 dark:border-slate-700" {...props} />
                      ),
                      td: ({node, ...props}) => (
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700" {...props} />
                      ),
                      h1: ({node, ...props}) => <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-6 pb-2 border-b-4 border-blue-500 inline-block" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-2xl font-black text-slate-700 dark:text-slate-200 mt-10 mb-4 flex items-center gap-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mt-6 mb-3" {...props} />,
                      blockquote: ({node, ...props}) => (
                        <blockquote className="border-l-8 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-6 my-8 rounded-r-2xl italic text-blue-900 dark:text-blue-200 font-medium" {...props} />
                      ),
                    }}
                   >
                    {selectedMaterial.content}
                   </ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center no-print">
                   <div className="mb-6 text-slate-300 dark:text-slate-700">
                      <Sparkles size={64} />
                   </div>
                   <h3 className="text-2xl font-black text-slate-700 dark:text-slate-100 mb-2">Apostila ainda não criada</h3>
                   <p className="text-slate-400 dark:text-slate-500 font-bold mb-8 max-w-md">
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
          /* Esconde absolutamente tudo por padrão */
          body * {
            visibility: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Mostra apenas a área de conteúdo do modal e seus filhos */
          .print-content,
          .print-content * {
            visibility: visible !important;
          }

          /* Posiciona a área de impressão no topo e ocupa a página toda */
          .print-content {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: auto !important;
            background: white !important;
            margin: 0 !important;
            padding: 1.5cm !important; /* Margem padrão de impressão */
            z-index: 9999 !important;
          }

          /* Garante que o container interno do material também seja visível */
          .print-content > div {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: none !important;
          }

          /* Estiliza o texto para ficar preto no fundo branco */
          .print-content .prose {
            color: black !important;
            max-width: none !important;
            font-size: 12pt !important;
          }

          /* Esconde elementos indesejados (botões, scrollbars, etc) */
          .no-print, 
          button,
          .fixed.inset-0.z-\[100\]:not(.print-content) {
            display: none !important;
          }

          /* Força quebras de página corretas */
          h1, h2, h3 { page-break-after: avoid !important; }
          p, li { page-break-inside: auto !important; }
          blockquote, table { page-break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
};

export default Materials;
