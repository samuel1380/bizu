import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ChatMessage, StudyMaterial, StudyRoutine } from '../types';
import { supabaseService } from './supabaseService';
import { supabase } from './supabaseClient';

// Define se o app deve usar Supabase ou IndexedDB
// Por padrão, se as chaves do Supabase estiverem configuradas, usaremos Supabase
const USE_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_URL !== 'seu_url_do_supabase';

interface BizuDB extends DBSchema {
  stats: {
    key: string;
    value: {
      id: string;
      totalQuestions: number;
      totalCorrect: number;
      lastStudyDate: string; // ISO date string YYYY-MM-DD
      currentStreak: number;
    };
  };
  quiz_history: {
    key: number;
    value: {
      date: Date;
      topic: string;
      totalQuestions: number;
      score: number;
    };
    indexes: { 'by-date': Date };
  };
  chat_messages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-timestamp': Date };
  };
  materials: {
    key: string;
    value: StudyMaterial;
    indexes: { 'by-category': string };
  };
  routine: {
    key: string;
    value: StudyRoutine;
  };
}

const DB_NAME = 'bizu-db';
const DB_VERSION = 3; // Incremented version for routine

let dbPromise: Promise<IDBPDatabase<BizuDB>>;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<BizuDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Stats store
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'id' });
        }
        // Quiz History store
        if (!db.objectStoreNames.contains('quiz_history')) {
          const store = db.createObjectStore('quiz_history', { keyPath: 'id', autoIncrement: true });
          store.createIndex('by-date', 'date');
        }
        // Chat Messages store
        if (!db.objectStoreNames.contains('chat_messages')) {
          const store = db.createObjectStore('chat_messages', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
        }
        // Materials store (Added in v2)
        if (!db.objectStoreNames.contains('materials')) {
          const store = db.createObjectStore('materials', { keyPath: 'id' });
          store.createIndex('by-category', 'category');
        }
        // Routine store (Added in v3)
        if (!db.objectStoreNames.contains('routine')) {
          db.createObjectStore('routine', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const getUserStats = async () => {
  if (USE_SUPABASE) return supabaseService.getUserStats();
  const db = await getDB();
  const stats = await db.get('stats', 'user_stats');
  if (!stats) {
    return {
      totalQuestions: 0,
      totalCorrect: 0,
      lastStudyDate: '',
      currentStreak: 0,
    };
  }
  return stats;
};

export const saveQuizResult = async (topic: string, total: number, score: number) => {
  if (USE_SUPABASE) return supabaseService.saveQuizResult(topic, total, score);
  const db = await getDB();
  const tx = db.transaction(['stats', 'quiz_history'], 'readwrite');
  
  // 1. Save History
  await tx.objectStore('quiz_history').add({
    date: new Date(),
    topic,
    totalQuestions: total,
    score
  });

  // 2. Update Stats
  const statsStore = tx.objectStore('stats');
  let stats = await statsStore.get('user_stats');
  
  const today = new Date().toISOString().split('T')[0];
  
  if (!stats) {
    stats = {
      id: 'user_stats',
      totalQuestions: 0,
      totalCorrect: 0,
      lastStudyDate: today,
      currentStreak: 1
    };
  } else {
    stats.totalQuestions += total;
    stats.totalCorrect += score;
    
    // Streak Logic
    if (stats.lastStudyDate !== today) {
      const lastDate = new Date(stats.lastStudyDate);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toISOString().split('T')[0];
      
      if (stats.lastStudyDate === yesterdayString) {
        stats.currentStreak += 1;
      } else {
        stats.currentStreak = 1;
      }
      stats.lastStudyDate = today;
    }
  }
  
  await statsStore.put(stats);
  await tx.done;
};

export const saveChatMessage = async (message: ChatMessage) => {
  if (USE_SUPABASE) return supabaseService.saveChatMessage(message);
  const db = await getDB();
  await db.put('chat_messages', message);
};

export const getChatHistory = async (): Promise<ChatMessage[]> => {
  if (USE_SUPABASE) return supabaseService.getChatHistory();
  const db = await getDB();
  return db.getAllFromIndex('chat_messages', 'by-timestamp');
};

export const clearChatHistory = async () => {
    if (USE_SUPABASE) return supabaseService.clearChatHistory();
    const db = await getDB();
    await db.clear('chat_messages');
};

// Materials Helpers
export const getAllMaterials = async (): Promise<StudyMaterial[]> => {
  if (USE_SUPABASE) return supabaseService.getAllMaterials();
  const db = await getDB();
  return db.getAll('materials');
};

export const saveMaterial = async (material: StudyMaterial) => {
  if (USE_SUPABASE) return supabaseService.saveMaterial(material);
  const db = await getDB();
  await db.put('materials', material);
};

export const saveMaterialsBatch = async (materials: StudyMaterial[]) => {
  if (USE_SUPABASE) {
    for (const m of materials) await supabaseService.saveMaterial(m);
    return;
  }
  const db = await getDB();
  const tx = db.transaction('materials', 'readwrite');
  const store = tx.objectStore('materials');
  for (const material of materials) {
    await store.put(material);
  }
  await tx.done;
};

export const clearAllMaterials = async () => {
  if (USE_SUPABASE) return supabaseService.clearAllMaterials();
  const db = await getDB();
  await db.clear('materials');
};

// Routine Helpers
export const getStudyRoutine = async (): Promise<StudyRoutine | undefined> => {
  let userId = '';

  // 1. Tentar carregar do Supabase se configurado
  if (USE_SUPABASE) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const cloudRoutine = await supabaseService.getStudyRoutine();
        if (cloudRoutine && cloudRoutine.weekSchedule && cloudRoutine.weekSchedule.length > 0) {
          // Manter cache local sincronizado com a nuvem
          try {
            localStorage.setItem(`bizu_routine_${user.id}`, JSON.stringify(cloudRoutine));
            localStorage.setItem('bizu_user_routine', JSON.stringify(cloudRoutine));
            const db = await getDB();
            await db.put('routine', cloudRoutine);
          } catch (e) { }
          return cloudRoutine;
        }
      }
    } catch (e) {
      console.warn("[DB] Erro ao consultar rotina da nuvem:", e);
    }
  }

  // 2. Fallback de alta prioridade: LocalStorage do usuário ou geral
  try {
    const userStorageKey = userId ? `bizu_routine_${userId}` : null;
    const localUserRaw = userStorageKey ? localStorage.getItem(userStorageKey) : null;
    const localGenericRaw = localStorage.getItem('bizu_user_routine');
    const rawToUse = localUserRaw || localGenericRaw;

    if (rawToUse) {
      const parsed = JSON.parse(rawToUse);
      if (parsed && Array.isArray(parsed.weekSchedule) && parsed.weekSchedule.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("[DB] Erro ao ler rotina do localStorage:", e);
  }

  // 3. Fallback final: IndexedDB
  try {
    const db = await getDB();
    const idbRoutine = await db.get('routine', 'user_routine');
    if (idbRoutine && Array.isArray(idbRoutine.weekSchedule) && idbRoutine.weekSchedule.length > 0) {
      return idbRoutine;
    }
  } catch (e) {
    console.warn("[DB] Erro ao buscar rotina no IndexedDB:", e);
  }

  return undefined;
};

export const saveStudyRoutine = async (routine: StudyRoutine) => {
  if (!routine) return;
  routine.id = 'user_routine';

  // 1. Salvar IMEDIATAMENTE no localStorage (garante sobrevivência entre rotas e refresh)
  try {
    localStorage.setItem('bizu_user_routine', JSON.stringify(routine));
  } catch (e) { }

  // 2. Salvar IMEDIATAMENTE no IndexedDB
  try {
    const db = await getDB();
    await db.put('routine', routine);
  } catch (e) {
    console.warn("[DB] Erro ao salvar rotina no IndexedDB:", e);
  }

  // 3. Se usuário logado e Supabase ativo, sincronizar com a nuvem e chave de usuário
  if (USE_SUPABASE) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          localStorage.setItem(`bizu_routine_${user.id}`, JSON.stringify(routine));
        } catch (e) { }
        await supabaseService.saveStudyRoutine(routine);
      }
    } catch (e) {
      console.warn("[DB] Erro ao sincronizar rotina com o Supabase:", e);
    }
  }
};

export const deleteStudyRoutine = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      localStorage.removeItem(`bizu_routine_${user.id}`);
    }
    localStorage.removeItem('bizu_user_routine');
  } catch (e) { }

  try {
    const db = await getDB();
    await db.delete('routine', 'user_routine');
  } catch (e) {
    console.warn("[DB] Erro ao remover rotina do IndexedDB:", e);
  }

  if (USE_SUPABASE) {
    try {
      await supabaseService.deleteStudyRoutine();
    } catch (e) {
      console.warn("[DB] Erro ao deletar rotina da nuvem:", e);
    }
  }
};

export const clearLocalUserData = async () => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('bizu_') || key === 'user_stats' || key === 'bizu_user_routine')) {
        localStorage.removeItem(key);
      }
    }
    const db = await getDB();
    const tx = db.transaction(['chat_messages', 'materials', 'routine'], 'readwrite');
    await Promise.all([
      tx.objectStore('chat_messages').clear(),
      tx.objectStore('materials').clear(),
      tx.objectStore('routine').clear(),
      tx.done
    ]);
  } catch (e) {
    console.warn("Erro ao limpar dados locais do usuário:", e);
  }
};

