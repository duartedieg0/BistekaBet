// src/lib/api-football/client.ts
import "server-only";
import { FixturesResponseSchema, TeamsResponseSchema } from "./schemas";
import type { ApiFootballFixture, ApiFootballTeam } from "./types";

const BASE = "https://v3.football.api-sports.io";

function getConfig() {
  const key = process.env.API_FOOTBALL_KEY;
  const league = process.env.API_FOOTBALL_LEAGUE_ID;
  const season = process.env.API_FOOTBALL_SEASON;
  if (!key || !league || !season) {
    throw new Error("API-Football env vars missing (API_FOOTBALL_KEY, API_FOOTBALL_LEAGUE_ID, API_FOOTBALL_SEASON)");
  }
  return { key, league, season };
}

async function call<T>(path: string, schema: { parse: (x: unknown) => T }): Promise<T> {
  const { key } = getConfig();
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return schema.parse(json);
}

export async function fetchFixtures(): Promise<ApiFootballFixture[]> {
  const { league, season } = getConfig();
  const r = await call(
    `/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,
    FixturesResponseSchema,
  );
  return r.response;
}

export async function fetchTeams(): Promise<ApiFootballTeam[]> {
  const { league, season } = getConfig();
  const r = await call(
    `/teams?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,
    TeamsResponseSchema,
  );
  return r.response;
}
