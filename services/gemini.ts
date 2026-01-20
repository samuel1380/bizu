import { QuizConfig, Question, StudyMaterial, StudyRoutine, NewsItem } from '../types';

// --- CONFIGURAÇÃO BÁSICA ---
// O frontend agora apenas pede dados ao backend. Toda a inteligência está no servidor.

const apiCall = async (action: string, payload: any = {}) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Erro do Servidor (${response.status})`);
    }

    return data;
  } catch (error: any) {
    console.error(`[Frontend] Erro na ação ${action}:`, error);
    throw error;
  }
};

// --- FUNÇÕES EXPORTADAS (INTERFACE LIMPA) ---

export const hasApiKey = (): boolean => true; // O backend gerencia a chave agora

export const generateQuizQuestions = async (config: QuizConfig): Promise<Question[]> => {
  return await apiCall('generateQuiz', config);
};

export const askBizuTutor = async (history: {role: string, parts: {text: string}[]}[], message: string): Promise<string> => {
  const result = await apiCall('askTutor', { history, message });
  return result.text;
};

export const generateStudyMaterials = async (count: number = 3): Promise<StudyMaterial[]> => {
  const materials = await apiCall('generateMaterials', { count });
  // Adiciona IDs temporários para garantir renderização correta no React
  return materials.map((m: any) => ({
    ...m,
    id: m.id || crypto.randomUUID(),
    updatedAt: new Date().toISOString()
  }));
};

export const generateMaterialContent = async (material: StudyMaterial): Promise<string> => {
  const result = await apiCall('generateMaterialContent', { material });
  return result.content;
};

export const createCustomMaterial = async (topic: string): Promise<StudyMaterial> => {
  const material = await apiCall('createCustomMaterial', { topic });
  return {
    ...material,
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString()
  };
};

export const generateStudyRoutine = async (targetExam: string, hours: number, subjects: string): Promise<StudyRoutine> => {
  const result = await apiCall('generateRoutine', { targetExam, hours, subjects });
  return {
    targetExam,
    hoursPerDay: hours,
    weekSchedule: result.weekSchedule || [],
    createdAt: new Date()
  };
};

export const updateContestRadar = async (): Promise<NewsItem[]> => {
  const result = await apiCall('updateRadar');
  return result.map((item: any, index: number) => ({
    ...item,
    id: item.id || `news-${Date.now()}-${index}`
  }));
};
