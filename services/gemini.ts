import { QuizConfig, Question, StudyMaterial, StudyRoutine, NewsItem } from '../types';

// Função auxiliar para esperar (sleep)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função auxiliar para chamar a API do Vercel (/api/gemini) com Retry Automático
const callApi = async (action: string, payload: any = {}, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Tenta ler o corpo da resposta independentemente do status
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        // Se não for JSON (ex: erro HTML do Vercel), lê como texto
        const text = await response.text();
        data = { error: text };
      }

      if (!response.ok) {
        // Loga o erro detalhado no console para o desenvolvedor ver
        console.error(`[API Error] ${action} failed with status ${response.status}:`, data);
        
        const errorMessage = data.error || data.details || `Erro desconhecido (${response.status})`;
        
        // Se for erro do servidor (500) ou rate limit (429), permite retry
        if (response.status >= 500 || response.status === 429) {
             throw new Error(errorMessage); 
        }
        
        // Erros 4xx são fatais, não faz retry
        throw new Error(errorMessage);
      }

      return data;

    } catch (error: any) {
      const isLastAttempt = attempt === retries - 1;
      
      // Se for AbortError (timeout), trata diferente
      if (error.name === 'AbortError') {
          console.warn(`Tentativa ${attempt + 1} de ${action} excedeu o tempo limite.`);
      } else {
          console.warn(`Tentativa ${attempt + 1} falhou para ${action}:`, error.message);
      }

      if (isLastAttempt) {
        console.error(`Todas as tentativas falharam para ${action}. Último erro: ${error.message}`);
        throw error;
      }
      
      // Backoff exponencial
      const delay = 1000 * Math.pow(2, attempt);
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