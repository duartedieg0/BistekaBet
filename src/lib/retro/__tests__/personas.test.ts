import { describe, expect, it } from "vitest";
import {
  derivePersona,
  PERSONA_THRESHOLDS as T,
  type PersonaSignals,
} from "@/lib/retro/personas";

const base: PersonaSignals = {
  currentRank: 50,
  totalPlayers: 100,
  totalPoints: 40,
  exactsTotal: 0,
  exactsKnockout: 0,
  winnerOrDrawTotal: 0,
  predictionsScored: 0,
  firstRank: 50,
  rankVolatility: 0,
};

describe("derivePersona", () => {
  it("Pódio quando termina no top N", () => {
    expect(derivePersona({ ...base, currentRank: T.podioMaxRank }).key).toBe("podio");
  });

  it("Cravador quando tem muitas na mosca", () => {
    expect(derivePersona({ ...base, exactsTotal: T.cravadorMinExacts }).key).toBe("cravador");
  });

  it("Vidente com alta taxa de acerto e amostra suficiente", () => {
    const s = {
      ...base,
      predictionsScored: T.videnteMinScored,
      winnerOrDrawTotal: Math.ceil(T.videnteMinScored * T.videnteMinRate),
    };
    expect(derivePersona(s).key).toBe("vidente");
  });

  it("Vidente NÃO dispara com amostra pequena (2/2)", () => {
    const s = { ...base, predictionsScored: 2, winnerOrDrawTotal: 2 };
    expect(derivePersona(s).key).not.toBe("vidente");
  });

  it("Escalador quando sobe muitas posições", () => {
    const s = { ...base, firstRank: 40, currentRank: 40 - T.escaladorMinClimb };
    expect(derivePersona(s).key).toBe("escalador");
  });

  it("Montanha-Russa quando oscila muito", () => {
    expect(
      derivePersona({ ...base, rankVolatility: T.montanhaRussaMinVolatility }).key,
    ).toBe("montanha_russa");
  });

  it("Fallback Fiel de Torcida quando nada casa", () => {
    expect(derivePersona(base).key).toBe("fiel");
  });

  it("prioridade: Pódio vence Cravador quando ambos casam", () => {
    const s = { ...base, currentRank: 1, exactsTotal: T.cravadorMinExacts + 5 };
    expect(derivePersona(s).key).toBe("podio");
  });

  it("reason contém o número real do usuário", () => {
    const p = derivePersona({ ...base, exactsTotal: T.cravadorMinExacts + 2 });
    expect(p.reason).toContain(String(T.cravadorMinExacts + 2));
  });
});
