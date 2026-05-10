export const INSCRIPTION_VALUE_BRL = 75;

export const COMPETITION = {
  name: "Copa do Mundo 2026",
  startDate: "2026-06-11",
  endDate: "2026-07-19",
  startLabel: "11 jun",
  endLabel: "19 jul",
  totalMatches: 104,
  totalCountries: 48,
} as const;

export type PhaseKey =
  | "grupos"
  | "32avos"
  | "oitavas"
  | "quartas"
  | "semifinal"
  | "terceiro"
  | "final";

export type PhasePoints = {
  key: PhaseKey;
  label: string;
  winnerOrDraw: number;
  winnerPlusGoals: number;
  exactScore: number;
};

export const PHASE_POINTS: ReadonlyArray<PhasePoints> = [
  { key: "grupos", label: "Fase de grupos", winnerOrDraw: 2, winnerPlusGoals: 4, exactScore: 7 },
  { key: "32avos", label: "32 avos", winnerOrDraw: 3, winnerPlusGoals: 6, exactScore: 10 },
  { key: "oitavas", label: "Oitavas", winnerOrDraw: 4, winnerPlusGoals: 8, exactScore: 13 },
  { key: "quartas", label: "Quartas", winnerOrDraw: 6, winnerPlusGoals: 11, exactScore: 18 },
  { key: "semifinal", label: "Semifinal", winnerOrDraw: 8, winnerPlusGoals: 15, exactScore: 25 },
  { key: "terceiro", label: "3º lugar", winnerOrDraw: 7, winnerPlusGoals: 13, exactScore: 22 },
  { key: "final", label: "Final", winnerOrDraw: 11, winnerPlusGoals: 20, exactScore: 34 },
] as const;

export const PRIZE_SPLIT = [
  { place: 1, label: "1º lugar", percentage: 50 },
  { place: 2, label: "2º lugar", percentage: 35 },
  { place: 3, label: "3º lugar", percentage: 15 },
] as const;

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
