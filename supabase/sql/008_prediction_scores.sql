-- BistekaBet — materialização de pontos por palpite (SP-02)
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

create table public.prediction_scores (
  prediction_id uuid primary key references public.predictions(id) on delete cascade,
  match_id      uuid not null references public.matches(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  points        int  not null check (points >= 0),
  tier          text not null check (tier in ('exact','winner_or_draw','miss')),
  scored_at     timestamptz not null default now()
);

create index prediction_scores_user_idx       on public.prediction_scores (user_id);
create index prediction_scores_match_idx      on public.prediction_scores (match_id);
create index prediction_scores_user_tier_idx  on public.prediction_scores (user_id, tier);

alter table public.prediction_scores enable row level security;

create policy "scores_select_authenticated" on public.prediction_scores
  for select to authenticated using (true);

create policy "scores_admin_write" on public.prediction_scores
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
