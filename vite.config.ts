import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente
  // Cast process to any to avoid TS error with cwd()
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      // Increase limit to silence warning for vendor chunks
      chunkSizeWarningLimit: 1600, 
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
            ai: ['@google/genai'],
            db: ['idb']
          }
        }
      }
    },
    define: {
      // Garante que a chave seja uma string, mesmo que vazia, para evitar crash no JSON.stringify
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      // Evita erro de "process is not defined" no navegador
      'process.env': {} 
    }
  };
});