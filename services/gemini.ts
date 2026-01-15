import { QuizConfig, Question, StudyMaterial, StudyRoutine, NewsItem } from '../types';

// Função auxiliar para esperar (sleep)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função auxiliar para chamar a API com Retry Automático
const callApi = async (action: string, payload: any = {}, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Controller para implementar Timeout no frontend
      const controller = new AbortController();
      // Aumentamos o timeout para 90s, pois alguns modelos podem demorar
      const timeoutId = setTimeout(() => controller.abort(), 90000); 

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Se for Rate Limit (429) ou erro de servidor (5xx), tentamos de novo
        if (response.status === 429 || response.status >= 500) {
             console.warn(`Tentativa ${attempt + 1}: Erro ${response.status}`);
             throw new Error(`Server Error ${response.status}`);
        }
        
        // Erros 4xx (BadRequest) não devem ter retry
        let errorMessage = `Erro na API (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
          // Ignora erro de parse
        }
        throw new Error(errorMessage);
      }

      return await response.json();

    } catch (error: any) {
      const isLastAttempt = attempt === retries - 1;
      
      // Se for AbortError (Timeout do cliente), não adianta tentar muito rápido
      if (error.name === 'AbortError') {
         console.error(`Timeout na requisição para ${action}`);
         if (isLastAttempt) throw new Error("O servidor demorou muito para responder. Tente novamente.");
      }

      if (isLastAttempt) {
        console.error(`Falha final para ${action}:`, error.message);
        throw error;
      }
      
      // Backoff exponencial: 2s, 4s, 8s...
      const delay = 2000 * Math.pow(2, attempt);
      await wait(delay);
    }
  }
};

export const hasApiKey = (): boolean => true;

export const generateQuizQuestions = async (config: QuizConfig): Promise<Question[]> => {
  return callApi('generateQuiz', config);
};

export const askBizuTutor = async (history: {role: string, parts: {text: string}[]}[], message: string): Promise<string> => {
  const result = await callApi('askTutor', { history, message });
  return result.text;
};

export const generateStudyMaterials = async (count: number = 3): Promise<StudyMaterial[]> => {
  const rawMaterials = await callApi('generateMaterials', { count });
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
  const items = await callApi('updateRadar');
  return items.map((item: any, index: number) => ({
    ...item,
    id: item.id || `news-${Date.now()}-${index}`
  }));
};
