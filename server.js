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

// Adaptador para converter Express Request/Response -> Edge Request/Response
// Isso permite reutilizar a lógica da api/gemini.js
app.post('/api/gemini', async (req, res) => {
  try {
    // Cria um objeto Request compatível com Web Standards
    const webReq = new Request('http://localhost/api/gemini', {
      method: 'POST',
      headers: new Headers(req.headers),
      body: JSON.stringify(req.body)
    });

    // Chama o handler original (que agora é Edge compatible)
    const webRes = await apiHandler(webReq);
    
    // Converte a resposta de volta para Express
    const data = await webRes.json();
    res.status(webRes.status).json(data);

  } catch (error) {
    console.error('Server Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Qualquer outra rota retorna o index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Bizu Server running on port ${PORT}`);
});
