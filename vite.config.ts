import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente (incluindo .env locais e do sistema/Vercel/Render)
  // Fix: Cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" error
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
    },
    define: {
      // Substitui process.env.API_KEY pelo valor real durante o build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Evita erro de "process is not defined" no navegador
      'process.env': {} 
    }
  };
});