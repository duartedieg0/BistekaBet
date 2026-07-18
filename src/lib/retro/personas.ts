export type PersonaKey =
  | "podio" | "cravador" | "vidente"
  | "escalador" | "montanha_russa" | "fiel";

export type PersonaSignals = {
  currentRank: number;
  totalPlayers: number;
  totalPoints: number;
  exactsTotal: number;
  exactsKnockout: number;
  winnerOrDrawTotal: number;   // tier != "miss"
  predictionsScored: number;   // total de prediction_scores do usuário
  firstRank: number;           // rank no 1º dia pontuado
  rankVolatility: number;      // soma dos |delta| ao longo da timeline
};

export type Persona = {
  key: PersonaKey;
  title: string;
  emoji: string;
  subtitle: string;
  reason: string;
};

// Calibrados contra dados reais do grupo. Os testes referenciam estas constantes
// (não literais), então ajustar um valor aqui NÃO quebra os testes.
export const PERSONA_THRESHOLDS = {
  podioMaxRank: 3,
  cravadorMinExacts: 13,
  videnteMinScored: 20,
  videnteMinRate: 0.62,
  escaladorMinClimb: 10,
  montanhaRussaMinVolatility: 20,
} as const;

const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

type Rule = {
  matches: (s: PersonaSignals) => boolean;
  build: (s: PersonaSignals) => Persona;
};

// Ordem = prioridade. A última regra é o fallback (matches sempre true).
const RULES: Rule[] = [
  {
    matches: (s) => s.currentRank <= PERSONA_THRESHOLDS.podioMaxRank,
    build: (s) => ({
      key: "podio", title: "Rei do Pódio", emoji: "👑",
      subtitle: "Você fechou a Copa lá em cima.",
      reason: `Terminou em #${s.currentRank} de ${s.totalPlayers} — pódio é pra poucos.`,
    }),
  },
  {
    matches: (s) => s.exactsTotal >= PERSONA_THRESHOLDS.cravadorMinExacts,
    build: (s) => ({
      key: "cravador", title: "O Cravador", emoji: "🎯",
      subtitle: "Placar exato é com você mesmo.",
      reason: `Você cravou ${s.exactsTotal} placares na mosca.`,
    }),
  },
  {
    matches: (s) =>
      s.predictionsScored >= PERSONA_THRESHOLDS.videnteMinScored &&
      rate(s.winnerOrDrawTotal, s.predictionsScored) >= PERSONA_THRESHOLDS.videnteMinRate,
    build: (s) => ({
      key: "vidente", title: "O Vidente", emoji: "🔮",
      subtitle: "Você via o resultado antes da bola rolar.",
      reason: `Acertou o resultado em ${Math.round(
        rate(s.winnerOrDrawTotal, s.predictionsScored) * 100,
      )}% dos seus palpites.`,
    }),
  },
  {
    matches: (s) => s.firstRank - s.currentRank >= PERSONA_THRESHOLDS.escaladorMinClimb,
    build: (s) => ({
      key: "escalador", title: "O Escalador", emoji: "🧗",
      subtitle: "Começou embaixo e foi subindo.",
      reason: `Subiu ${s.firstRank - s.currentRank} posições ao longo da Copa.`,
    }),
  },
  {
    matches: (s) => s.rankVolatility >= PERSONA_THRESHOLDS.montanhaRussaMinVolatility,
    build: () => ({
      key: "montanha_russa", title: "Montanha-Russa", emoji: "🎢",
      subtitle: "Sua Copa teve emoção do início ao fim.",
      reason: "Poucos oscilaram tanto no ranking quanto você.",
    }),
  },
  {
    matches: () => true,
    build: (s) => ({
      key: "fiel", title: "Fiel de Torcida", emoji: "🇧🇷",
      subtitle: "Você esteve presente e torceu junto.",
      reason: `${s.totalPoints} pontos torcendo do começo ao fim.`,
    }),
  },
];

export function derivePersona(s: PersonaSignals): Persona {
  const rule = RULES.find((r) => r.matches(s)) ?? RULES[RULES.length - 1];
  return rule.build(s);
}
