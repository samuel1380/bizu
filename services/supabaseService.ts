import { supabase } from './supabaseClient';
import { ChatMessage, StudyMaterial, StudyRoutine } from '../types';

export const supabaseService = {
  // Stats
  async getUserStats() {
    const { data, error } = await supabase
      .from('stats')
      .select('*')
      .eq('id', 'user_stats')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Erro ao buscar stats:', error);
    }

    return data || {
      totalQuestions: 0,
      totalCorrect: 0,
      lastStudyDate: '',
      currentStreak: 0,
    };
  },

  async saveQuizResult(topic: string, total: number, score: number) {
    // 1. Save History
    const { error: historyError } = await supabase
      .from('quiz_history')
      .insert({
        topic,
        total_questions: total,
        score,
        date: new Date().toISOString(),
      });

    if (historyError) console.error('Erro ao salvar histórico de quiz:', historyError);

    // 2. Update Stats
    const stats = await this.getUserStats();
    const today = new Date().toISOString().split('T')[0];
    
    const updatedStats = {
      ...stats,
      id: 'user_stats',
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

    if (statsError) console.error('Erro ao salvar stats:', statsError);
  },

  // Chat
  async saveChatMessage(message: ChatMessage) {
    const { error } = await supabase
      .from('chat_messages')
      .insert(message);
    if (error) console.error('Erro ao salvar mensagem de chat:', error);
  },

  async getChatHistory(): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar histórico de chat:', error);
      return [];
    }
    return data || [];
  },

  async clearChatHistory() {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .neq('id', ''); // Delete all
    if (error) console.error('Erro ao limpar histórico de chat:', error);
  },

  // Materials
  async getAllMaterials(): Promise<StudyMaterial[]> {
    const { data, error } = await supabase
      .from('materials')
      .select('*');
    if (error) {
      console.error('Erro ao buscar materiais:', error);
      return [];
    }
    return data || [];
  },

  async saveMaterial(material: StudyMaterial) {
    const { error } = await supabase
      .from('materials')
      .upsert(material);
    if (error) console.error('Erro ao salvar material:', error);
  },

  // Routine
  async getStudyRoutine(): Promise<StudyRoutine | undefined> {
    const { data, error } = await supabase
      .from('routine')
      .select('*')
      .eq('id', 'user_routine')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar rotina:', error);
    }
    return data || undefined;
  },

  async saveStudyRoutine(routine: StudyRoutine) {
    const { error } = await supabase
      .from('routine')
      .upsert({ ...routine, id: 'user_routine' });
    if (error) console.error('Erro ao salvar rotina:', error);
  },

  async deleteStudyRoutine() {
    const { error } = await supabase
      .from('routine')
      .delete()
      .eq('id', 'user_routine');
    if (error) console.error('Erro ao deletar rotina:', error);
  }
};
