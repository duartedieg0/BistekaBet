-- BistekaBet — schema de teams e matches (Copa 2026)
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

-- =========================
-- Helper: trigger updated_at
-- =========================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =========================
-- teams
-- =========================
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  flag_url    text,
  group_code  text check (group_code is null or group_code ~ '^[A-L]$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

alter table public.teams enable row level security;

create policy "teams_select_authenticated" on public.teams
  for select to authenticated using (true);

create policy "teams_admin_write" on public.teams
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- =========================
-- matches
-- =========================
create table public.matches (
  id                uuid primary key default gen_random_uuid(),
  stage             text not null check (stage in (
                      'group','round_of_32','round_of_16',
                      'quarter','semi','third_place','final'
                    )),
  group_code        text check (group_code is null or group_code ~ '^[A-L]$'),
  bracket_position  int,
  home_team_id      uuid references public.teams(id) on delete restrict,
  away_team_id      uuid references public.teams(id) on delete restrict,
  kickoff_at        timestamptz not null,
  venue             text,
  status            text check (status is null or status in ('postponed','cancelled')),
  home_score        int check (home_score is null or home_score >= 0),
  away_score        int check (away_score is null or away_score >= 0),
  home_score_et     int check (home_score_et is null or home_score_et >= 0),
  away_score_et     int check (away_score_et is null or away_score_et >= 0),
  home_pens         int check (home_pens is null or home_pens >= 0),
  away_pens         int check (away_pens is null or away_pens >= 0),
  winner_team_id    uuid references public.teams(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint matches_group_requires_group_code
    check ((stage = 'group') = (group_code is not null)),
  constraint matches_knockout_requires_position
    check (stage = 'group' or bracket_position is not null),
  constraint matches_distinct_teams
    check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);

create index matches_stage_group_kickoff_idx on public.matches (stage, group_code, kickoff_at);
create index matches_stage_bracket_idx on public.matches (stage, bracket_position);
create index matches_kickoff_idx on public.matches (kickoff_at);
create index matches_home_team_idx on public.matches (home_team_id);
create index matches_away_team_idx on public.matches (away_team_id);

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

alter table public.matches enable row level security;

create policy "matches_select_authenticated" on public.matches
  for select to authenticated using (true);

create policy "matches_admin_write" on public.matches
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
