import { QuizConfig, Question, StudyMaterial, StudyRoutine } from '../types';

// Função auxiliar para chamar a API Serverless (Backend)
// Isso remove a necessidade da API Key no frontend e protege as credenciais
const callApi = async (action: string, payload: any) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });

    if (!response.ok) {
      let errorMessage = `Erro ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
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

// Não precisamos mais verificar a chave no cliente, pois o backend gerencia isso.
export const hasApiKey = (): boolean => true;

export const generateQuizQuestions = async (config: QuizConfig): Promise<Question[]> => {
  // A API já retorna o array de questões parseado
  return callApi('generateQuiz', config);
};

export const askBizuTutor = async (history: {role: string, parts: {text: string}[]}[], message: string): Promise<string> => {
  const result = await callApi('askTutor', { history, message });
  return result.text;
};

export const generateStudyMaterials = async (count: number = 3): Promise<StudyMaterial[]> => {
  const rawMaterials = await callApi('generateMaterials', { count });
  
  // Adiciona IDs e datas no cliente, pois o backend foca apenas no conteúdo
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
  
  // Reconstrói o objeto de rotina completo com os dados da IA
  return {
    targetExam,
    hoursPerDay: hours,
    weekSchedule: result.weekSchedule,
    createdAt: new Date()
  };
};