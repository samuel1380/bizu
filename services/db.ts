import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ChatMessage, StudyMaterial, StudyRoutine } from '../types';
import { supabaseService } from './supabaseService';

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

// Routine Helpers
export const getStudyRoutine = async (): Promise<StudyRoutine | undefined> => {
  if (USE_SUPABASE) return supabaseService.getStudyRoutine();
  const db = await getDB();
  return db.get('routine', 'user_routine');
};

export const saveStudyRoutine = async (routine: StudyRoutine) => {
  if (USE_SUPABASE) return supabaseService.saveStudyRoutine(routine);
  const db = await getDB();
  routine.id = 'user_routine';
  await db.put('routine', routine);
};

export const deleteStudyRoutine = async () => {
  if (USE_SUPABASE) return supabaseService.deleteStudyRoutine();
  const db = await getDB();
  await db.delete('routine', 'user_routine');
};