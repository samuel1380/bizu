-- =============================================
-- FIX: Corrigir foreign key da tabela materials
-- O problema: user_id referencia tabela errada
-- =============================================

-- 1. Remover a foreign key constraint que tá bloqueando
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_user_id_fkey;

-- 2. Verificar se tem outras constraints problemáticas
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS fk_user_id;
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_user_id_fkey1;

-- 3. Recriar a foreign key corretamente apontando para auth.users
ALTER TABLE public.materials 
  ADD CONSTRAINT materials_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Pronto! Agora o user_id vai aceitar os IDs do Supabase Auth
