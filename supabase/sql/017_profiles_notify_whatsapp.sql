-- BistekaBet — opt-in/opt-out de lembrete WhatsApp
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.
--
-- default true cobre opt-in tanto para usuários novos quanto para os
-- existentes (o default é aplicado às linhas atuais durante o ALTER TABLE).
-- O próprio usuário deve poder mudar este campo livremente — diferente de
-- whatsapp/role, não exige trigger nem service role. As policies existentes
-- (profiles_update_own) cobrem a permissão.

alter table public.profiles
  add column notify_whatsapp boolean not null default true;
