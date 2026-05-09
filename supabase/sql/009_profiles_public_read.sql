-- BistekaBet — leitura pública de profiles entre autenticados (SP-03)
-- A classificação precisa exibir display_name, avatar_url e paid de todos.
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
