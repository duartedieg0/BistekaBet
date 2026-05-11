// src/lib/api-football/__tests__/mapper.test.ts
import { describe, it, expect } from "vitest";
import { mapFixtureToPatch } from "@/lib/api-football/mapper";
import type { ApiFootballFixture } from "@/lib/api-football/types";

const HOME = "00000000-0000-0000-0000-000000000001";
const AWAY = "00000000-0000-0000-0000-000000000002";

const baseFixture = (overrides: Partial<ApiFootballFixture> = {}): ApiFootballFixture => ({
  fixture: { id: 999, date: "2026-06-12T20:00:00Z",
             status: { short: "FT", long: "Match Finished" } },
  teams: { home: { id: 1, name: "Brasil" }, away: { id: 2, name: "Argentina" } },
  goals: { home: 2, away: 1 },
  score: {
    halftime:  { home: 1, away: 0 },
    fulltime:  { home: 2, away: 1 },
    extratime: { home: null, away: null },
    penalty:   { home: null, away: null },
  },
  ...overrides,
});

describe("mapFixtureToPatch", () => {
  it("FT: regulation win, winner=home, status=null", () => {
    const p = mapFixtureToPatch(baseFixture(), HOME, AWAY);
    expect(p).toMatchObject({
      api_football_id: 999,
      home_score: 2, away_score: 1,
      home_score_et: null, away_score_et: null,
      home_pens: null, away_pens: null,
      winner_team_id: HOME,
      status: null,
    });
  });

  it("FT: draw in group stage, winner_team_id=null", () => {
    const p = mapFixtureToPatch(baseFixture({
      goals: { home: 1, away: 1 },
      score: { halftime: { home:0, away:0 }, fulltime:{ home:1, away:1 },
               extratime:{ home:null, away:null }, penalty:{ home:null, away:null } },
    }), HOME, AWAY);
    expect(p.winner_team_id).toBeNull();
  });

  it("AET: extra time decides", () => {
    const p = mapFixtureToPatch(baseFixture({
      fixture: { id: 999, date: "2026-06-12T20:00:00Z",
                 status: { short: "AET", long: "Match Finished after Extra Time" } },
      goals: { home: 3, away: 2 },
      score: { halftime:{ home:1, away:1 }, fulltime:{ home:2, away:2 },
               extratime:{ home:1, away:0 }, penalty:{ home:null, away:null } },
    }), HOME, AWAY);
    expect(p.home_score_et).toBe(1);
    expect(p.away_score_et).toBe(0);
    expect(p.winner_team_id).toBe(HOME); // 3 > 2
    expect(p.status).toBeNull();
  });

  it("PEN: away wins shootout", () => {
    const p = mapFixtureToPatch(baseFixture({
      fixture: { id: 999, date: "2026-06-12T20:00:00Z",
                 status: { short: "PEN", long: "Match Finished after Penalties" } },
      goals: { home: 2, away: 2 },
      score: { halftime:{ home:1, away:1 }, fulltime:{ home:2, away:2 },
               extratime:{ home:0, away:0 }, penalty:{ home:3, away:5 } },
    }), HOME, AWAY);
    expect(p.home_pens).toBe(3);
    expect(p.away_pens).toBe(5);
    expect(p.winner_team_id).toBe(AWAY);
    expect(p.status).toBeNull();
  });

  it("PST → status='postponed', placares null", () => {
    const p = mapFixtureToPatch(baseFixture({
      fixture: { id: 999, date: "2026-06-12T20:00:00Z",
                 status: { short: "PST", long: "Match Postponed" } },
      goals: { home: null, away: null },
      score: { halftime:{ home:null, away:null }, fulltime:{ home:null, away:null },
               extratime:{ home:null, away:null }, penalty:{ home:null, away:null } },
    }), HOME, AWAY);
    expect(p.status).toBe("postponed");
    expect(p.home_score).toBeNull();
    expect(p.winner_team_id).toBeNull();
  });

  it("CANC → status='cancelled'", () => {
    const p = mapFixtureToPatch(baseFixture({
      fixture: { id: 999, date: "2026-06-12T20:00:00Z",
                 status: { short: "CANC", long: "Match Cancelled" } },
      goals: { home: null, away: null },
      score: { halftime:{ home:null, away:null }, fulltime:{ home:null, away:null },
               extratime:{ home:null, away:null }, penalty:{ home:null, away:null } },
    }), HOME, AWAY);
    expect(p.status).toBe("cancelled");
  });
});
