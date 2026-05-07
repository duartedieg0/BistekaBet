-- BistekaBet — schema de predictions (palpites do usuário)
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

create table public.predictions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  match_id         uuid not null references public.matches(id) on delete cascade,
  home_score       int  not null check (home_score >= 0),
  away_score       int  not null check (away_score >= 0),
  advances_team_id uuid references public.teams(id) on delete restrict,
  advances_slot    text check (advances_slot in ('home','away')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, match_id)
);

create index predictions_user_idx  on public.predictions (user_id);
create index predictions_match_idx on public.predictions (match_id);

create trigger predictions_set_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();

alter table public.predictions enable row level security;

create policy "predictions_select_own" on public.predictions
  for select to authenticated using (user_id = auth.uid());

create policy "predictions_insert_own_before_kickoff" on public.predictions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  );

create policy "predictions_update_own_before_kickoff" on public.predictions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  );
