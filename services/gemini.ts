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
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let data: any = null;

    if (contentType.includes('application/json')) {
      data = text ? JSON.parse(text) : null;
    } else {
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      if (data?.error) {
        throw new Error(data.error);
      }
      if (text && text.trim().startsWith('<!DOCTYPE')) {
        throw new Error('Resposta HTML recebida. Verifique se o backend /api/gemini está ativo.');
      }
      throw new Error(`Erro do Servidor (${response.status})`);
    }

    if (!data && text) {
      if (text.trim().startsWith('<!DOCTYPE')) {
        throw new Error('Resposta HTML recebida. Verifique se o backend /api/gemini está ativo.');
      }
      return text as any;
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
