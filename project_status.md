# Estado Atual do Projeto Bizu App

Este documento serve como um mapa de tudo o que já foi implementado, configurado e está funcionando no projeto. O objetivo é manter o agente de IA sintonizado com o estado real do projeto e evitar caminhos errados.

## 🚨 Configurações Principais
- **Frontend**: React + TypeScript + Vite + Tailwind CSS.
- **Backend**: Node.js + Express (rodando no `server.js`).
- **Banco de Dados/Auth**: Supabase.
- **Integrações de IA**: Gemini (Google), com fallback estruturado para outros modelos caso haja falha (Mistral, Groq, OpenRouter).
- **Hospedagem atual**: Render (backend/frontend integrado).
- **Diretório Local**: `c:\Users\samuel\OneDrive\Documentos\bizu bot atualizadp` (Nota: o nome da pasta termina com 'p' intencionalmente).

## ✅ O Que Já Foi Feito e Está Funcionando

### 1. Sistema de Autenticação e Usuários
- Login e Cadastro viabilizados via Supabase Auth.
- Rotina de sessão ativa e contagem de acessos do usuário (`login_count`, `last_login`, `total_time_spent`).
- Controle de acesso (Admin vs Aluno) usando uma lista de emails admin no App.tsx.
- Verificação de assinatura (Hubla) antes de liberar o acesso à plataforma.

### 2. Banco de Dados (Supabase)
- **Tabela `profiles`**: Guarda informações de stats, controle de tempo e assinaturas.
- **Tabela `stats`**: Estatísticas isoladas por usuário (ID único: `{user.id}_stats`), resolvendo o bug anterior de chaves duplicadas.
- **Tabela `routine`**: Rotina de estudos do usuário (`{user.id}_routine`).
- **Tabela `chat_messages`**: Histórico do chat com a IA (Mentor).
- **Tabela `materials`**: (Onde tivemos os maiores ajustes). A tabela foi recriada/alterada para garantir o funcionamento. O frontend faz a ordenação via JS em vez de `.order('updatedAt')` na query, evitando erro HTTP 400 caso a coluna tenha indexação/nome diferente. E a foreign key `user_id` foi corrigida para apontar para `auth.users(id)`.

### 3. Funcionalidades Principais Modificadas Recentemente
- **Tratamento Anti-Crash (`supabaseService.ts`)**: Adicionamos blocos completos de `try/catch` em **TODAS** as chamadas do Supabase. Isso impede o React de dar crash (tela preta/branca) quando o Supabase retorna erros 400 ou 406 (ex: tabela não encontrada, foreign key errada). Assim, a requisição pode falhar silenciosamente no console, mas a UI não quebra.
- **Extração de Vídeo do YouTube (`handleExtractYoutubeContent`)**: 
  - A transcrição é buscada **ANTES** de escolher a IA (não depende de nenhuma IA para essa etapa).
  - A transcrição é passada para **QUALQUER IA disponível** (Gemini → Mistral → Groq → OpenRouter) via sistema de fallback.
  - Se o Gemini estiver no limite de uso, outra IA assume automaticamente.
  - O conteúdo gerado é devolvido em Markdown rico, estruturado como uma apostila.
  - Frontend tem um botão "EXTRAIR DE VÍDEO" que abre um modal para inserir a URL.
  - Null-checks adicionados para prevenir crash quando a IA retorna dados incompletos.

## ⚠️ Problemas Conhecidos e Observações Importantes
- **Erros 400/406 no Console**: Requisições de rede feitas pelo client do Supabase que encontram dados vazios (406 no `.single()`) ou problemas de schema (400) **sempre** ficarão marcadas de vermelho no console do navegador Chrome. Isso é um comportamento padrão do browser e *não significa necessariamente um crash no app*, desde que estejam em um `try/catch` adequado (como estão agora).
- Se o usuário clica num botão (como Extrair Vídeo) e o app trava (tela branca), o erro normalmente não é o aviso vermelho do console sobre a API, mas alguma exceção JavaScript não tratada na interface (ex: ler uma propriedade de `undefined`).

---
Este arquivo será atualizado continuamente para não perdermos o contexto do sistema.
