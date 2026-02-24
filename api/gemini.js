// ESTE ARQUIVO ESTÁ DEPRECIADO.
// Toda a lógica foi migrada para o 'server.js' para garantir compatibilidade com Node.js no Render.
// Não delete este arquivo se o build tool esperar que ele exista, mas ele não executa lógica.

export default function handler(req, res) {
  res.status(404).json({ error: "Endpoint deprecated. Use /api/gemini handled by server.js" });
}
