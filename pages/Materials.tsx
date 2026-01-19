import React, { useState, useEffect } from 'react';
import { StudyMaterial } from '../types';
import { generateStudyMaterials, generateMaterialContent } from '../services/gemini';
import { getAllMaterials, saveMaterialsBatch, saveMaterial } from '../services/db';
import { FileText, Book, Search, Loader2, X, Sparkles, Printer, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
      
      // Captura o conteúdo Markdown renderizado
      const proseContent = document.querySelector('.prose')?.innerHTML || '';
      
      // Cria um elemento temporário para o PDF com estilos embutidos para garantir consistência
      const element = document.createElement('div');
      element.style.width = '100%';
      element.innerHTML = `
        <style>
          .pdf-container {
            padding: 20px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #1e293b;
            line-height: 1.6;
            background: white;
          }
          .pdf-header {
            border-bottom: 4px solid #2563eb;
            margin-bottom: 30px;
            padding-bottom: 20px;
            text-align: left;
          }
          .pdf-title {
            font-size: 32px;
            font-weight: 900;
            margin: 0;
            color: #0f172a;
            line-height: 1.1;
          }
          .pdf-subtitle {
            color: #64748b;
            font-weight: 800;
            margin: 10px 0 0 0;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.05em;
          }
          .pdf-content {
            font-size: 14px;
          }
          /* Estilização básica para simular o 'prose' do Tailwind */
          .pdf-content h1 { font-size: 24px; font-weight: 800; margin-top: 24px; margin-bottom: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; }
          .pdf-content h2 { font-size: 20px; font-weight: 800; margin-top: 20px; margin-bottom: 12px; color: #1e293b; }
          .pdf-content h3 { font-size: 18px; font-weight: 700; margin-top: 16px; margin-bottom: 8px; color: #334155; }
          .pdf-content p { margin-bottom: 12px; }
          .pdf-content ul, .pdf-content ol { margin-bottom: 16px; padding-left: 20px; }
          .pdf-content li { margin-bottom: 4px; }
          .pdf-content blockquote { 
            border-left: 4px solid #3b82f6; 
            background: #eff6ff; 
            padding: 12px 20px; 
            margin: 20px 0; 
            font-style: italic;
            border-radius: 0 8px 8px 0;
          }
          .pdf-content table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
          .pdf-content th { background: #f8fafc; text-align: left; padding: 10px; border: 1px solid #e2e8f0; font-weight: 700; }
          .pdf-content td { padding: 10px; border: 1px solid #e2e8f0; }
          .pdf-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            font-weight: bold;
          }
          /* Forçar quebras de página evitarem cortar títulos ou blocos */
          h1, h2, h3 { page-break-after: avoid; }
          blockquote, table, pre { page-break-inside: avoid; }
        </style>
        <div class="pdf-container">
          <div class="pdf-header">
            <h1 class="pdf-title">${selectedMaterial.title}</h1>
            <p class="pdf-subtitle">Bizu App • Material de Estudo para Concursos</p>
          </div>
          <div class="pdf-content">
            ${proseContent}
          </div>
          <div class="pdf-footer">
            ESTE MATERIAL É PARTE INTEGRANTE DO BIZU APP • © ${new Date().getFullYear()} • TODOS OS DIREITOS RESERVADOS
          </div>
        </div>
      `;

      const opt = {
        margin: [15, 15, 15, 15],
        filename: `Bizu_Apostila_${selectedMaterial.title.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollY: 0,
          windowWidth: 800 // Fixa a largura para garantir que o layout não quebre como se fosse mobile
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Adiciona o elemento ao corpo temporariamente para o html2canvas conseguir renderizar corretamente
      document.body.appendChild(element);
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.top = '0';
      element.style.width = '800px'; // Largura fixa para o canvas

      await html2pdf().set(opt).from(element).save();
      
      // Remove o elemento temporário
      document.body.removeChild(element);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Tente usar o botão de Imprimir.");
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:bg-white print:static print:p-0 print-content">
          <div className="bg-white rounded-none md:rounded-3xl w-full max-w-4xl h-full md:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 md:border-b-8 md:border-slate-300 print:border-none print:shadow-none print:max-w-none print:max-h-none">
            
            {/* Header (Hidden on Print) */}
            <div className="flex items-start justify-between p-6 border-b-2 border-slate-100 bg-white no-print">
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
                    <>
                      <button 
                          onClick={handleDownloadPDF}
                          disabled={downloadingPDF}
                          className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors flex items-center gap-2"
                          title="Baixar PDF Direto"
                      >
                          {downloadingPDF ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} strokeWidth={2.5} />}
                          <span className="hidden md:block font-bold text-sm">BAIXAR PDF</span>
                      </button>
                      <button 
                          onClick={handlePrintPDF}
                          className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors hidden md:block"
                          title="Salvar como PDF / Imprimir"
                      >
                          <Printer size={24} strokeWidth={2.5} />
                      </button>
                    </>
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
                <div className="flex flex-col items-center justify-center py-20 text-center no-print">
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
