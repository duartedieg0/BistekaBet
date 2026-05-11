import { z } from "zod";

// status.short é a chave para decidir mapping; pinamos via z.enum para detectar mudança de schema da API.
// Ver §3.1 do spec.
export const ApiFootballStatusShort = z.enum([
  "TBD", "NS", "1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT",
  "FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO", "LIVE",
]);

export const FixtureSchema = z.object({
  fixture: z.object({
    id: z.number().int(),
    date: z.string(),
    status: z.object({
      short: ApiFootballStatusShort,
      long: z.string(),
    }),
  }),
  teams: z.object({
    home: z.object({ id: z.number().int(), name: z.string() }),
    away: z.object({ id: z.number().int(), name: z.string() }),
  }),
  goals: z.object({
    home: z.number().int().nullable(),
    away: z.number().int().nullable(),
  }),
  score: z.object({
    halftime:  z.object({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
    fulltime:  z.object({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
    extratime: z.object({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
    penalty:   z.object({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
  }),
});

export const FixturesResponseSchema = z.object({
  response: z.array(FixtureSchema),
});

export const TeamSchema = z.object({
  team: z.object({
    id: z.number().int(),
    name: z.string(),
    code: z.string().nullable(),
  }),
});

export const TeamsResponseSchema = z.object({
  response: z.array(TeamSchema),
});
