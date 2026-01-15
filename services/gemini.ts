import { QuizConfig, Question, StudyMaterial, StudyRoutine, NewsItem } from '../types';

// Cliente HTTP simples e direto
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
      // Repassa a mensagem de erro vinda do servidor
      throw new Error(data.error || `Erro no servidor: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error(`Erro na ação ${action}:`, error);
    throw error; // O componente React lidará com o erro visualmente
  }
};

// --- Funções Exportadas para o Frontend ---

export const hasApiKey = (): boolean => true;

export const generateQuizQuestions = async (config: QuizConfig): Promise<Question[]> => {
  // O backend deve retornar { questions: [...] } ou o array direto
  const result = await apiCall('generateQuiz', config);
  return result; 
};

export const askBizuTutor = async (history: {role: string, parts: {text: string}[]}[], message: string): Promise<string> => {
  const result = await apiCall('askTutor', { history, message });
  return result.text;
};

export const generateStudyMaterials = async (count: number = 3): Promise<StudyMaterial[]> => {
  const result = await apiCall('generateMaterials', { count });
  // Adiciona IDs temporários caso o backend não mande (segurança de frontend)
  return result.map((m: any) => ({
    ...m,
    id: m.id || crypto.randomUUID(),
    updatedAt: new Date().toISOString().split('T')[0]
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
