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

export const generateQuizQuestions = async (config: QuizConfig, studyType: string = 'concurso'): Promise<Question[]> => {
  return await apiCall('generateQuiz', { ...config, studyType });
};

export const askBizuTutor = async (history: {role: string, parts: {text: string}[]}[], message: string): Promise<string> => {
  const result = await apiCall('askTutor', { history, message });
  return result.text;
};

export const generateStudyMaterials = async (count: number = 3, studyType: string = 'concurso'): Promise<StudyMaterial[]> => {
  const materials = await apiCall('generateMaterials', { count, studyType });
  // Adiciona IDs temporários apenas se não existirem
  return materials.map((m: any) => ({
    ...m,
    id: m.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
    updatedAt: m.updatedAt || new Date().toISOString()
  }));
};

export const generateMaterialContent = async (material: StudyMaterial, studyType: string = 'concurso'): Promise<string> => {
  const result = await apiCall('generateMaterialContent', { material, studyType });
  return result.content;
};

export const extendMaterialContent = async (material: StudyMaterial, currentContent: string, studyType: string = 'concurso'): Promise<string> => {
  const result = await apiCall('extendMaterialContent', { material, currentContent, studyType });
  return result.content;
};

export const createCustomMaterial = async (topic: string, studyType: string = 'concurso'): Promise<StudyMaterial> => {
  const material = await apiCall('createCustomMaterial', { topic, studyType });
  return {
    ...material,
    id: material.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
    updatedAt: new Date().toISOString()
  };
};

export const generateStudyRoutine = async (targetExam: string, hours: number, subjects: string, studyType: string = 'concurso'): Promise<StudyRoutine> => {
  const result = await apiCall('generateRoutine', { targetExam, hours, subjects, studyType });
  return {
    targetExam,
    hoursPerDay: hours,
    weekSchedule: result.weekSchedule || [],
    createdAt: new Date(),
    studyType // Adicionando ao retorno se necessário no futuro
  };
};

export const updateContestRadar = async (existingTitles: string[] = [], studyType: string = 'concurso'): Promise<any> => {
  const result = await apiCall('updateRadar', { existingTitles, studyType });
  
  if (result.no_updates) {
    return { no_updates: true };
  }

  return result.map((item: any, index: number) => ({
    ...item,
    id: item.id || `news-${Date.now()}-${index}`
  }));
};
