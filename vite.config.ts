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
      // Fix for "Chunk size warning" - increases limit and splits vendor files
      chunkSizeWarningLimit: 1000, 
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
      // Substitui process.env.API_KEY pelo valor real durante o build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Evita erro de "process is not defined" no navegador
      'process.env': {} 
    }
  };
});