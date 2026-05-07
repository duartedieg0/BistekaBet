import { z } from "zod";

export const savePredictionSchema = z
  .object({
    matchId: z.string().uuid(),
    homeScore: z.number().int().nonnegative(),
    awayScore: z.number().int().nonnegative(),
    advancesTeamId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    advancesSlot: z.enum(["home", "away"]).nullable().optional().transform((v) => v ?? null),
  })
  .refine(
    (v) => !(v.advancesTeamId && v.advancesSlot),
    { message: "Use advancesTeamId OU advancesSlot, não os dois.", path: ["advancesSlot"] },
  );

export type SavePredictionInput = z.infer<typeof savePredictionSchema>;

export const savePredictionsBatchSchema = z
  .array(savePredictionSchema)
  .min(1)
  .max(72);

export type SavePredictionsBatchInput = z.infer<typeof savePredictionsBatchSchema>;
