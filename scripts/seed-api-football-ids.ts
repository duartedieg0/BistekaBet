// scripts/seed-api-football-ids.ts
// Roda 1x: pnpm tsx scripts/seed-api-football-ids.ts
// Idempotente. Casa teams por nome normalizado e matches por (home_team_id, away_team_id, date).

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { fetchTeams, fetchFixtures } from "../src/lib/api-football/client";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Supabase env vars missing");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1) Teams
  const apiTeams = await fetchTeams();
  const { data: dbTeams, error: tErr } = await supabase.from("teams").select("id, name, api_football_id");
  if (tErr) throw tErr;

  const dbByName = new Map(dbTeams!.map((t) => [normalize(t.name), t]));
  let teamsUpdated = 0, teamsAmbiguous = 0;

  for (const at of apiTeams) {
    const t = dbByName.get(normalize(at.team.name));
    if (!t) { console.warn(`[teams] sem match: ${at.team.name} (api_id=${at.team.id})`); teamsAmbiguous++; continue; }
    if (t.api_football_id === at.team.id) continue;
    const { error } = await supabase.from("teams").update({ api_football_id: at.team.id }).eq("id", t.id);
    if (error) { console.error(`[teams] update falhou ${t.name}:`, error.message); continue; }
    teamsUpdated++;
  }
  console.log(`teams: ${teamsUpdated} updated, ${teamsAmbiguous} sem match`);

  // 2) Matches
  const fixtures = await fetchFixtures();
  const { data: dbMatches, error: mErr } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, kickoff_at, api_football_id, home_team:teams!matches_home_team_id_fkey(api_football_id), away_team:teams!matches_away_team_id_fkey(api_football_id)");
  if (mErr) throw mErr;

  let matchesUpdated = 0, matchesUnmatched = 0;

  for (const fx of fixtures) {
    const found = dbMatches!.find((m) => {
      const homeApi = (m.home_team as unknown as { api_football_id: number | null } | null)?.api_football_id;
      const awayApi = (m.away_team as unknown as { api_football_id: number | null } | null)?.api_football_id;
      if (homeApi !== fx.teams.home.id) return false;
      if (awayApi !== fx.teams.away.id) return false;
      // mesmo dia (UTC) — tolerância pra fusos:
      const dDb = new Date(m.kickoff_at).toISOString().slice(0, 10);
      const dApi = new Date(fx.fixture.date).toISOString().slice(0, 10);
      return dDb === dApi;
    });
    if (!found) { matchesUnmatched++; continue; }
    if (found.api_football_id === fx.fixture.id) continue;
    const { error } = await supabase.from("matches").update({ api_football_id: fx.fixture.id }).eq("id", found.id);
    if (error) { console.error(`[matches] update falhou ${found.id}:`, error.message); continue; }
    matchesUpdated++;
  }
  console.log(`matches: ${matchesUpdated} updated, ${matchesUnmatched} sem match`);
}

main().catch((e) => { console.error(e); process.exit(1); });
