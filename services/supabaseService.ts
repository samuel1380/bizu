import { supabase } from './supabaseClient';
import { ChatMessage, StudyMaterial, StudyRoutine } from '../types';

const DEFAULT_STATS = { totalQuestions: 0, totalCorrect: 0, lastStudyDate: '', currentStreak: 0 };

export const supabaseService = {
  // Stats
  async getUserStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { ...DEFAULT_STATS };

      const statsId = `${user.id}_stats`;
      const { data, error } = await supabase
        .from('stats')
        .select('*')
        .eq('id', statsId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Supabase] Erro ao buscar stats:', error.message);
      }

      return data || { ...DEFAULT_STATS };
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao buscar stats:', err?.message);
      return { ...DEFAULT_STATS };
    }
  },

  async saveQuizResult(topic: string, total: number, score: number) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Save History
      const { error: historyError } = await supabase
        .from('quiz_history')
        .insert({
          topic,
          total_questions: total,
          score,
          date: new Date().toISOString(),
          user_id: user.id
        });

      if (historyError) console.warn('[Supabase] Erro ao salvar histórico de quiz:', historyError.message);

      // 2. Update Stats
      const stats = await this.getUserStats();
      const today = new Date().toISOString().split('T')[0];
      const statsId = `${user.id}_stats`;

      const updatedStats = {
        ...stats,
        id: statsId,
        user_id: user.id,
        totalQuestions: stats.totalQuestions + total,
        totalCorrect: stats.totalCorrect + score,
      };

      if (stats.lastStudyDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toISOString().split('T')[0];

        if (stats.lastStudyDate === yesterdayString) {
          updatedStats.currentStreak += 1;
        } else {
          updatedStats.currentStreak = 1;
        }
        updatedStats.lastStudyDate = today;
      }

      const { error: statsError } = await supabase
        .from('stats')
        .upsert(updatedStats);

      if (statsError) console.warn('[Supabase] Erro ao salvar stats:', statsError.message);
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao salvar quiz result:', err?.message);
    }
  },

  // Chat
  async saveChatMessage(message: ChatMessage) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('chat_messages')
        .upsert({
          ...message,
          user_id: user.id,
          timestamp: typeof message.timestamp === 'string' ? message.timestamp : message.timestamp.toISOString()
        });
      if (error) console.warn('[Supabase] Erro ao salvar mensagem:', error.message);
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao salvar mensagem:', err?.message);
    }
  },

  async getChatHistory(): Promise<ChatMessage[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      if (error) {
        console.warn('[Supabase] Erro ao buscar chat:', error.message);
        return [];
      }
      return (data || []).map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao buscar chat:', err?.message);
      return [];
    }
  },

  async clearChatHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', user.id);
      if (error) console.warn('[Supabase] Erro ao limpar chat:', error.message);
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao limpar chat:', err?.message);
    }
  },

  // Materials
  async getAllMaterials(): Promise<StudyMaterial[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('user_id', user.id);
        
      if (error) {
        console.warn('[Supabase] Erro ao buscar materiais (ignorando):', error.message);
        return [];
      }
      
      const materials = data || [];
      materials.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      return materials;
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao buscar materiais (ignorando):', err?.message);
      return [];
    }
  },

  async saveMaterial(material: StudyMaterial) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('materials')
        .upsert({
          ...material,
          user_id: user.id
        });
      if (error) console.warn('[Supabase] Erro ao salvar material:', error.message);
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao salvar material:', err?.message);
    }
  },

  async clearAllMaterials() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('user_id', user.id);
      if (error) console.warn('[Supabase] Erro ao limpar materiais:', error.message);
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao limpar materiais:', err?.message);
    }
  },

  // Routine
  async getStudyRoutine(): Promise<StudyRoutine | undefined> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return undefined;

      const routineId = `${user.id}_routine`;
      const { data, error } = await supabase
        .from('routine')
        .select('*')
        .eq('id', routineId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Supabase] Erro ao buscar rotina:', error.message);
      }
      return data || undefined;
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao buscar rotina:', err?.message);
      return undefined;
    }
  },

  async saveStudyRoutine(routine: StudyRoutine) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const routineId = `${user.id}_routine`;
      const { error } = await supabase
        .from('routine')
        .upsert({ ...routine, id: routineId, user_id: user.id });
      if (error) console.warn('[Supabase] Erro ao salvar rotina:', error.message);
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao salvar rotina:', err?.message);
    }
  },

  async deleteStudyRoutine() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const routineId = `${user.id}_routine`;
      const { error } = await supabase
        .from('routine')
        .delete()
        .eq('id', routineId);
      if (error) console.warn('[Supabase] Erro ao deletar rotina:', error.message);
    } catch (err: any) {
      console.warn('[Supabase] Exceção ao deletar rotina:', err?.message);
    }
  }
};
