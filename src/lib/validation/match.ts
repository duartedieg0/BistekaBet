import { z } from "zod";
import { STAGES, GROUP_CODES } from "@/lib/types/match";

export const stageSchema = z.enum(STAGES);
export const groupCodeSchema = z.enum(GROUP_CODES);

const optionalNonNegativeInt = z
  .union([z.number().int().nonnegative(), z.literal("").transform(() => null), z.null()])
  .transform((v) => (v === null || v === undefined ? null : v));

export const updateMatchSchema = z
  .object({
    kickoff_at: z.string().min(1),
    venue: z.string().nullable().optional().transform((v) => v ?? null),
    home_team_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    away_team_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    home_score: optionalNonNegativeInt,
    away_score: optionalNonNegativeInt,
    home_score_et: optionalNonNegativeInt,
    away_score_et: optionalNonNegativeInt,
    home_pens: optionalNonNegativeInt,
    away_pens: optionalNonNegativeInt,
    winner_team_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    status: z.enum(["postponed", "cancelled"]).nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((v, ctx) => {
    const has90 = v.home_score !== null && v.away_score !== null;
    const hasET = v.home_score_et !== null || v.away_score_et !== null;
    const hasPens = v.home_pens !== null || v.away_pens !== null;
    if (hasET && !has90) {
      ctx.addIssue({ code: "custom", message: "Prorrogação exige placar de 90 min preenchido." });
    }
    if (hasPens) {
      const etComplete = v.home_score_et !== null && v.away_score_et !== null;
      if (!etComplete) {
        ctx.addIssue({ code: "custom", message: "Pênaltis exigem prorrogação preenchida." });
      }
    }
    if (v.home_team_id && v.away_team_id && v.home_team_id === v.away_team_id) {
      ctx.addIssue({ code: "custom", message: "Mandante e visitante não podem ser o mesmo time." });
    }
  });

export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;

export const upsertTeamSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().regex(/^[A-Z]{3}$/u, "Código FIFA com 3 letras maiúsculas."),
  name: z.string().min(1),
  flag_url: z.string().url().nullable().optional().transform((v) => v ?? null),
  group_code: groupCodeSchema.nullable().optional().transform((v) => v ?? null),
});
export type UpsertTeamInput = z.infer<typeof upsertTeamSchema>;
