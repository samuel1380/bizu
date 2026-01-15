import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente baseadas no modo (development/production)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
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
      // Injeta a chave da API no código do frontend de forma segura
      // O Vercel injeta automaticamente process.env.API_KEY se configurado no dashboard
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || ''),
      'process.env': {}
    }
  };
});