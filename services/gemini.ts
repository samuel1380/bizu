import { QuizConfig, Question, StudyMaterial, StudyRoutine, NewsItem } from '../types';

// Função auxiliar para chamar a API do Vercel (/api/gemini)
// Isso protege sua API KEY e evita erros de configuração no navegador
const callApi = async (action: string, payload: any = {}) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });

    if (!response.ok) {
      let errorMessage = `Erro na API (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
      } catch (e) {
        // Ignora erro de parse se não for JSON
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Erro na operação ${action}:`, error);
    throw error;
  }
};

// Como o backend gerencia a chave, consideramos que está sempre "configurado" no frontend
export const hasApiKey = (): boolean => true;

export const generateQuizQuestions = async (config: QuizConfig): Promise<Question[]> => {
  // Chama a API para gerar o quiz
  return callApi('generateQuiz', config);
};

export const askBizuTutor = async (history: {role: string, parts: {text: string}[]}[], message: string): Promise<string> => {
  const result = await callApi('askTutor', { history, message });
  return result.text;
};

export const generateStudyMaterials = async (count: number = 3): Promise<StudyMaterial[]> => {
  const rawMaterials = await callApi('generateMaterials', { count });
  
  // Adiciona IDs únicos e datas aqui no cliente para controle de interface
  return rawMaterials.map((m: any) => ({
    ...m,
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString().split('T')[0]
  }));
};

export const generateMaterialContent = async (material: StudyMaterial): Promise<string> => {
  const result = await callApi('generateMaterialContent', { material });
  return result.content;
};

export const generateStudyRoutine = async (targetExam: string, hours: number, subjects: string): Promise<StudyRoutine> => {
  const result = await callApi('generateRoutine', { targetExam, hours, subjects });
  
  return {
    targetExam,
    hoursPerDay: hours,
    weekSchedule: result.weekSchedule,
    createdAt: new Date()
  };
};

export const updateContestRadar = async (): Promise<NewsItem[]> => {
  // Gera IDs unicos no front caso o backend venha sem
  const items = await callApi('updateRadar');
  return items.map((item: any, index: number) => ({
    ...item,
    id: item.id || `news-${Date.now()}-${index}`
  }));
};