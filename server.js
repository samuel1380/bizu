import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import apiHandler from './api/gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do build (Frontend)
app.use(express.static(join(__dirname, 'dist')));

// Middleware para verificar API Key no ambiente (Log de aviso apenas)
app.use((req, res, next) => {
  if (!process.env.API_KEY && req.path.startsWith('/api')) {
    console.warn('⚠️ AVISO: API_KEY não encontrada nas variáveis de ambiente!');
  }
  next();
});

// Adaptador robusto para converter Express -> Edge Request
app.post('/api/gemini', async (req, res) => {
  try {
    // 1. Sanitizar Headers
    // Headers como 'host' e 'content-length' podem causar conflitos ao criar um novo Request interno
    const headers = new Headers();
    const ignoredHeaders = ['host', 'content-length', 'connection', 'transfer-encoding'];
    
    for (const [key, value] of Object.entries(req.headers)) {
      if (!ignoredHeaders.includes(key.toLowerCase())) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else if (value) {
          headers.set(key, value);
        }
      }
    }

    // 2. Criar Web Standard Request
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const webReq = new Request(fullUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body)
    });

    // 3. Chamar o Handler da API
    const webRes = await apiHandler(webReq);
    
    // 4. Converter Web Response -> Express Response
    const responseData = await webRes.json();
    
    // Copiar headers da resposta da API de volta para o cliente
    webRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(webRes.status).json(responseData);

  } catch (error) {
    console.error('❌ Server Proxy Error:', error);
    res.status(500).json({ 
      error: 'Erro interno no servidor (Proxy)',
      details: error.message 
    });
  }
});

// Fallback para SPA (Single Page Application)
// Qualquer rota não capturada acima retorna o index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Bizu Server running on port ${PORT}`);
  console.log(`Checking API Key... ${process.env.API_KEY ? 'OK' : 'MISSING'}`);
});