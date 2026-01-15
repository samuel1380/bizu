import { QuizConfig, Question, StudyMaterial, StudyRoutine, NewsItem } from '../types';

// Função auxiliar para esperar (sleep)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função auxiliar para chamar a API do Vercel (/api/gemini) com Retry Automático
const callApi = async (action: string, payload: any = {}, retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Controller para implementar Timeout no frontend (evita ficar pendurado infinitamente)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos limite máximo

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
        // Se for erro 5xx (servidor) ou 429 (rate limit), lança erro para cair no catch e tentar de novo
        if (response.status >= 500 || response.status === 429) {
             throw new Error(`Server Error ${response.status}`);
        }
        
        // Se for erro 4xx (cliente), não adianta tentar de novo
        let errorMessage = `Erro na API (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
          // Ignora
        }
        throw new Error(errorMessage);
      }

      return await response.json();

    } catch (error: any) {
      const isLastAttempt = attempt === retries - 1;
      console.warn(`Tentativa ${attempt + 1} falhou para ${action}:`, error.message);

      if (isLastAttempt) {
        console.error(`Todas as tentativas falharam para ${action}.`);
        throw error;
      }
      
      // Backoff exponencial: espera 1s, depois 2s, depois 4s...
      const delay = 1000 * Math.pow(2, attempt);
      await wait(delay);
    }
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