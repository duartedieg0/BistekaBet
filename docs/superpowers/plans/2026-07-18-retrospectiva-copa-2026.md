# Retrospectiva Copa 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a "Retrospectiva Copa 2026" — uma página pessoal rolável que reconta a jornada do usuário (coletivo → pessoal → persona) e gera um card 9:16 compartilhável para o Instagram Stories.

**Architecture:** Server Component em `/(authenticated)/retrospectiva` que reusa `loadRaioX` (timeline/highlights/hasData), soma contagens coletivas (count queries), escolhe a "zebra" do usuário e deriva uma **persona** via função pura. O card 9:16 é markup determinístico com cores da marca hardcoded; uma ilha `"use client"` usa `html-to-image` para gerar/baixar/compartilhar o PNG. Toda a lógica de negócio (personas, zebra, montagem) fica em funções puras testadas por TDD.

**Tech Stack:** Next.js 16 (App Router/RSC), React 19, Supabase (`@supabase/ssr`), Tailwind v4, recharts (já instalado), `html-to-image` (novo), sonner (toasts), vitest.

---

## ⚠️ Regras do projeto (ler antes de codar)

- **`AGENTS.md`:** este Next.js tem breaking changes. **Antes de escrever qualquer componente/página**, leia o guia relevante em `node_modules/next/dist/docs/` (App Router, Server/Client Components, `next/image`, metadata). Não assuma APIs de memória.
- **Skills instaladas sempre no repo**, nunca `-g`.
- **Teto de 1000 linhas do PostgREST:** agregações do grupo usam **count queries** (`{ count: "exact", head: true }`), nunca puxar linhas para contar.
- **Fuso:** buckets por dia usam `America/Sao_Paulo` (helpers de `src/lib/dates/sao-paulo-day.ts`).
- Spec de referência: `docs/superpowers/specs/2026-07-18-retrospectiva-copa-2026-design.md`.

## Mapa de arquivos

**Criar:**
- `src/lib/retro/personas.ts` — catálogo + regras de persona (puro).
- `src/lib/retro/__tests__/personas.test.ts`
- `src/lib/scoring/retro-core.ts` — heurístico de zebra + `buildRetrospectiva` (puro).
- `src/lib/scoring/__tests__/retro-core.test.ts`
- `src/lib/scoring/retro.ts` — `loadRetrospectiva` (server-only; queries + avatar inline).
- `src/app/(authenticated)/retrospectiva/page.tsx`
- `src/app/(authenticated)/retrospectiva/_components/`:
  `retro-hero.tsx`, `retro-collective.tsx`, `retro-journey.tsx`, `retro-rank-sparkline.tsx`,
  `retro-zebra.tsx`, `retro-persona-reveal.tsx`, `retro-closing.tsx`,
  `share-card.tsx`, `share-actions.tsx`, `retro-empty.tsx`
- `src/app/(authenticated)/inicio/_components/retro-banner.tsx`

**Modificar:**
- `src/app/(authenticated)/_components/auth-header.tsx` — item `NAV`.
- `src/app/(authenticated)/inicio/page.tsx` — inserir `<RetroBanner />`.
- `src/app/(authenticated)/raio-x/page.tsx` (ou um componente dele) — link para a retrospectiva.
- `package.json` / lockfile — `html-to-image`.

---

## Task 1: Calibração de personas, zebra e copy (checkpoint com o autor — sem código de produção)

**Objetivo:** travar limiares, textos e a lista de "grandes" **olhando dados reais do grupo**, antes de escrever os testes. Nada aqui vai pra produção; a saída são valores confirmados que alimentam as Tasks 3–5.

**Files:** nenhum de produção (opcionalmente um script descartável de leitura).

- [ ] **Step 1: Perfilar os dados reais (read-only)**

Rodar consultas de leitura (via `scripts/` com service role, ou Supabase Studio) para conhecer a distribuição do grupo e escolher limiares que gerem uma boa variedade de personas:
- distribuição de "na mosca" por usuário (`prediction_scores` `tier='exact'` agrupado por `user_id`);
- amplitude de rank (melhor vs. atual) por usuário;
- taxa de acerto de resultado (`tier != 'miss'` / total) por usuário;
- quantidade de acertos em jogos zebra-prone.

Expected: uma tabela mental de "quantos usuários cairiam em cada persona" com os defaults abaixo.

- [ ] **Step 2: Apresentar defaults ao autor e travar valores**

Defaults propostos (constantes em `personas.ts`):

| Constante | Default | Persona |
|---|---|---|
| `podioMaxRank` | 3 | 👑 Rei do Pódio |
| `cravadorMinExacts` | 6 | 🎯 O Cravador |
| `zebraMinHits` | 2 | 🦓 Amante da Zebra |
| `videnteMinScored` / `videnteMinRate` | 20 / 0.65 | 🔮 O Vidente |
| `escaladorMinClimb` | 10 | 🧗 O Escalador |
| `montanhaRussaMinVolatility` | 20 | 🎢 Montanha-Russa |

Lista "grandes" (zebra) default (códigos FIFA): `BRA, ARG, FRA, ESP, GER, POR, NED, ENG`.

Copy da despedida (Brasil/Hexa) — rascunho a validar:
> "Que jornada, hein? Foram 39 dias torcendo juntos — até por Jordânia × Argélia. Obrigado por viver a Copa com a gente. Que na próxima o Brasil venha mais competitivo e traga o Hexa. 🇧🇷"

- [ ] **Step 3: Registrar as decisões**

### ✅ CALIBRAÇÃO TRAVADA (dados reais: 37 jogadores pontuando, 3.645 palpites)

Perfil real observado: na mosca — mediana 10, p90 **13**, máx 17; taxa de acerto — máx **66%**;
"zebra-prone" não discrimina (min 21/jogador — quase todo jogo é sem seleção grande).

**Decisões do autor:**
- **🦓 "Amante da Zebra" REMOVIDA como persona.** O conceito de zebra fica **apenas no
  destaque narrativo** ("Sua zebra"). Consequência no código: `personas.ts` **não** tem
  regra de zebra; `PersonaSignals` **não** tem `zebraHits`; `buildRetrospectiva` não recebe
  `zebraHits`. `pickZebra`/`isZebraProne` continuam (Task 4) — usados só pela narrativa.
- **Limiares finais** (`PERSONA_THRESHOLDS`):

  | Constante | Valor travado |
  |---|---|
  | `podioMaxRank` | 3 |
  | `cravadorMinExacts` | **13** |
  | `videnteMinScored` / `videnteMinRate` | 20 / **0.62** |
  | `escaladorMinClimb` | 10 |
  | `montanhaRussaMinVolatility` | 20 |

- **Lista "grandes" (zebra):** `BRA, ARG, FRA, ESP, GER, POR, NED, ENG`.
- **Copy da despedida (travada):**
  > "Que jornada, hein? Foram 39 dias torcendo juntos — até por Jordânia × Argélia. Obrigado por viver a Copa com a gente. Que na próxima o Brasil venha mais competitivo e traga o Hexa. 🇧🇷"

**Ordem final das personas:** 👑 Pódio → 🎯 Cravador → 🔮 Vidente → 🧗 Escalador → 🎢 Montanha-Russa → 🇧🇷 Fiel (fallback).

**Sem commit** (nenhuma mudança de código nesta task). As Tasks 3–6 abaixo já refletem estes valores.

---

## Task 2: Instalar dependência `html-to-image`

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar (no repo, nunca -g)**

Run: `npm install html-to-image`
Expected: `html-to-image` aparece em `dependencies`; lockfile atualizado.

- [ ] **Step 2: Sanidade de build/test**

Run: `npm run test`
Expected: suíte atual continua passando (a lib ainda não é importada).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(retrospectiva): adiciona html-to-image para o card compartilhavel"
```

---

## Task 3: Catálogo e regras de persona (puro, TDD)

**Files:**
- Create: `src/lib/retro/personas.ts`
- Test: `src/lib/retro/__tests__/personas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/retro/__tests__/personas.test.ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/retro/__tests__/personas.test.ts`
Expected: FAIL (módulo `@/lib/retro/personas` não existe).

- [ ] **Step 3: Implementar `personas.ts`**

```ts
// src/lib/retro/personas.ts
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

// Calibrados na Task 1. Os testes referenciam estas constantes (não literais),
// então ajustar um valor aqui NÃO quebra os testes.
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
    build: (s) => ({
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/retro/__tests__/personas.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/retro/personas.ts src/lib/retro/__tests__/personas.test.ts
git commit -m "feat(retrospectiva): personas do bolao (funcao pura + testes)"
```

---

## Task 4: Heurístico de zebra (puro, TDD)

**Files:**
- Create: `src/lib/scoring/retro-core.ts` (parte 1: zebra)
- Test: `src/lib/scoring/__tests__/retro-core.test.ts` (parte 1)

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/scoring/__tests__/retro-core.test.ts
import { describe, expect, it } from "vitest";
import { isZebraProne, pickZebra, type ZebraCandidate } from "@/lib/scoring/retro-core";

const c = (over: Partial<ZebraCandidate>): ZebraCandidate => ({
  homeCode: "JOR", awayCode: "ALG", homeName: "Jordânia", awayName: "Argélia",
  tier: "exact", points: 7, ...over,
});

describe("isZebraProne", () => {
  it("dois times fora da lista de grandes = zebra-prone", () => {
    expect(isZebraProne("JOR", "ALG")).toBe(true);
  });
  it("jogo com um grande não é zebra-prone", () => {
    expect(isZebraProne("BRA", "ALG")).toBe(false);
    expect(isZebraProne("JOR", "FRA")).toBe(false);
  });
});

describe("pickZebra", () => {
  it("escolhe o melhor acerto (maior pontos) entre jogos zebra-prone", () => {
    const best = pickZebra([
      c({ points: 7, tier: "exact" }),
      c({ homeCode: "SEN", awayCode: "IRQ", points: 10, tier: "exact" }),
    ]);
    expect(best?.points).toBe(10);
  });
  it("ignora jogos com miss e jogos com time grande", () => {
    const z = pickZebra([
      c({ tier: "miss", points: 0 }),
      c({ homeCode: "BRA", awayCode: "MAR", tier: "exact", points: 7 }),
    ]);
    expect(z).toBeNull();
  });
  it("null quando não há acerto zebra-prone", () => {
    expect(pickZebra([])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/scoring/__tests__/retro-core.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar parte 1 de `retro-core.ts`**

```ts
// src/lib/scoring/retro-core.ts
import type { Tier } from "@/lib/scoring/score";

// Calibrada na Task 1. Seleções "tradicionais" (códigos FIFA).
export const TRADITIONAL_POWERS: ReadonlySet<string> = new Set([
  "BRA", "ARG", "FRA", "ESP", "GER", "POR", "NED", "ENG",
]);

export type ZebraCandidate = {
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  tier: Tier;
  points: number;
};

export function isZebraProne(homeCode: string, awayCode: string): boolean {
  return !TRADITIONAL_POWERS.has(homeCode) && !TRADITIONAL_POWERS.has(awayCode);
}

const TIER_RANK: Record<Tier, number> = { exact: 2, winner_or_draw: 1, miss: 0 };

export function pickZebra(candidates: ZebraCandidate[]): ZebraCandidate | null {
  const zebras = candidates.filter(
    (z) => z.tier !== "miss" && isZebraProne(z.homeCode, z.awayCode),
  );
  if (zebras.length === 0) return null;
  return zebras
    .slice()
    .sort((a, b) => b.points - a.points || TIER_RANK[b.tier] - TIER_RANK[a.tier])[0];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/scoring/__tests__/retro-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/retro-core.ts src/lib/scoring/__tests__/retro-core.test.ts
git commit -m "feat(retrospectiva): heuristico de zebra (funcao pura + testes)"
```

---

## Task 5: Montagem `buildRetrospectiva` (puro, TDD)

Combina os sinais já calculados (do Raio-X) numa estrutura de retrospectiva, derivando persona e volatilidade. **Não** faz I/O.

**Files:**
- Modify: `src/lib/scoring/retro-core.ts` (parte 2)
- Test: `src/lib/scoring/__tests__/retro-core.test.ts` (parte 2)

- [ ] **Step 1: Escrever o teste que falha**

```ts
// adicionar em retro-core.test.ts
import { buildRetrospectiva, rankVolatility } from "@/lib/scoring/retro-core";
import type { TimelinePoint } from "@/lib/scoring/raio-x-core";

const tl = (deltas: number[]): TimelinePoint[] =>
  deltas.map((delta, i) => ({
    day: `2026-06-${11 + i}`, rank: 10, cumulativePoints: 0,
    pointsThatDay: 0, matchesThatDay: 1, delta,
  }));

describe("rankVolatility", () => {
  it("soma os valores absolutos dos deltas", () => {
    expect(rankVolatility(tl([0, 3, -2, 5]))).toBe(10);
  });
});

describe("buildRetrospectiva", () => {
  it("monta persona, jornada e coletivo a partir dos sinais", () => {
    const r = buildRetrospectiva({
      highlights: {
        currentRank: 1, totalPlayers: 50, bestRank: 1, bestRankDay: "2026-07-01",
        biggestClimb: 4, biggestClimbDay: "2026-06-20", totalPoints: 120, exactsTotal: 8,
      },
      timeline: tl([0, 2, -1, 3]),
      exactsKnockout: 2, winnerOrDrawTotal: 30, predictionsScored: 40,
      zebra: null,
      collective: { players: 50, predictions: 2000, exacts: 300, matches: 104, days: 39 },
      hasData: true,
    });
    expect(r.persona.key).toBe("podio"); // rank 1
    expect(r.journey.totalPoints).toBe(120);
    expect(r.collective.players).toBe(50);
  });

  it("hasData=false força persona fallback (Fiel de Torcida)", () => {
    const r = buildRetrospectiva({
      highlights: {
        currentRank: 50, totalPlayers: 50, bestRank: 50, bestRankDay: "",
        biggestClimb: 0, biggestClimbDay: null, totalPoints: 0, exactsTotal: 0,
      },
      timeline: [], exactsKnockout: 0, winnerOrDrawTotal: 0, predictionsScored: 0,
      zebra: null,
      collective: { players: 50, predictions: 2000, exacts: 300, matches: 104, days: 39 },
      hasData: false,
    });
    expect(r.persona.key).toBe("fiel");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/scoring/__tests__/retro-core.test.ts`
Expected: FAIL (`buildRetrospectiva`/`rankVolatility` não existem).

- [ ] **Step 3: Implementar parte 2 de `retro-core.ts`**

```ts
// adicionar em retro-core.ts
import type { RaioXHighlights, TimelinePoint } from "@/lib/scoring/raio-x-core";
import { derivePersona, type Persona, type PersonaSignals } from "@/lib/retro/personas";

export type CollectiveStats = {
  players: number; predictions: number; exacts: number; matches: number; days: number;
};

export type RetroJourney = {
  currentRank: number; totalPlayers: number;
  totalPoints: number; exactsTotal: number;
  bestRank: number; bestRankDay: string;
  biggestClimb: number; biggestClimbDay: string | null;
};

export type Retrospectiva = {
  persona: Persona;
  journey: RetroJourney;
  timeline: TimelinePoint[];
  collective: CollectiveStats;
  zebra: ZebraCandidate | null;
  hasData: boolean;
};

export function rankVolatility(timeline: TimelinePoint[]): number {
  return timeline.reduce((sum, p) => sum + Math.abs(p.delta), 0);
}

export function buildRetrospectiva(input: {
  highlights: RaioXHighlights;
  timeline: TimelinePoint[];
  exactsKnockout: number;
  winnerOrDrawTotal: number;
  predictionsScored: number;
  zebra: ZebraCandidate | null;
  collective: CollectiveStats;
  hasData: boolean;
}): Retrospectiva {
  const { highlights: h, timeline, hasData } = input;
  const firstRank = timeline.length ? timeline[0].rank : h.totalPlayers;

  const signals: PersonaSignals = {
    currentRank: h.currentRank,
    totalPlayers: h.totalPlayers,
    totalPoints: h.totalPoints,
    exactsTotal: h.exactsTotal,
    exactsKnockout: input.exactsKnockout,
    winnerOrDrawTotal: input.winnerOrDrawTotal,
    predictionsScored: input.predictionsScored,
    firstRank,
    rankVolatility: rankVolatility(timeline),
  };

  // Sem dados: nunca uma persona competitiva. Força o fallback carinhoso.
  const persona = hasData
    ? derivePersona(signals)
    : derivePersona({ ...signals, currentRank: h.totalPlayers, exactsTotal: 0,
        predictionsScored: 0, rankVolatility: 0, firstRank: h.totalPlayers });

  return {
    persona,
    journey: {
      currentRank: h.currentRank, totalPlayers: h.totalPlayers,
      totalPoints: h.totalPoints, exactsTotal: h.exactsTotal,
      bestRank: h.bestRank, bestRankDay: h.bestRankDay,
      biggestClimb: h.biggestClimb, biggestClimbDay: h.biggestClimbDay,
    },
    timeline,
    collective: input.collective,
    zebra: input.zebra,
    hasData,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/scoring/__tests__/retro-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/retro-core.ts src/lib/scoring/__tests__/retro-core.test.ts
git commit -m "feat(retrospectiva): buildRetrospectiva monta persona + jornada + coletivo"
```

---

## Task 6: Loader server-only `loadRetrospectiva`

Reusa `loadRaioX`, soma contagens coletivas (count queries), busca os dados da zebra e inlina o avatar. **Sem teste unitário** (depende de Supabase; o valor de teste está no core).

**Files:**
- Create: `src/lib/scoring/retro.ts`
- Referências: `src/lib/scoring/raio-x.ts` (padrão de query/paginate), `src/lib/bolao-config.ts` (`COMPETITION`), `src/lib/supabase/server.ts`.

- [ ] **Step 1: Implementar `loadRetrospectiva`**

Estrutura (ajustar nomes de colunas conforme o schema real ao codar):

```ts
// src/lib/scoring/retro.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadRaioX } from "@/lib/scoring/raio-x";
import { COMPETITION } from "@/lib/bolao-config";
import {
  pickZebra, buildRetrospectiva,
  type ZebraCandidate, type Retrospectiva,
} from "./retro-core";

export type RetrospectivaView = Retrospectiva & {
  user: { displayName: string; avatarDataUrl: string | null };
};

async function toDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function loadRetrospectiva(userId: string): Promise<RetrospectivaView> {
  const supabase = await createClient();

  const raioX = await loadRaioX(userId); // timeline + highlights + hasData

  const [
    profile,
    playersCount,
    predsCount,
    groupExactsCount,
    userScores,       // prediction_scores do usuário + join matches/teams (tier, points, stage, códigos)
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("predictions").select("id", { count: "exact", head: true }),
    supabase.from("prediction_scores").select("prediction_id", { count: "exact", head: true }).eq("tier", "exact"),
    supabase
      .from("prediction_scores")
      .select("points, tier, matches!inner(home_team:home_team_id(code,name), away_team:away_team_id(code,name))")
      .eq("user_id", userId),
  ]);

  // Propagar erros com throw (padrão loadRanking/loadRaioX).
  for (const r of [profile, playersCount, predsCount, groupExactsCount, userScores]) {
    if (r.error) throw r.error;
  }

  // Sinais derivados dos scores do usuário
  const rows = (userScores.data ?? []) as unknown as Array<{
    points: number; tier: "exact" | "winner_or_draw" | "miss";
    matches: { home_team: { code: string; name: string }; away_team: { code: string; name: string } };
  }>;
  const predictionsScored = rows.length;
  const winnerOrDrawTotal = rows.filter((r) => r.tier !== "miss").length;
  // Nenhuma persona atual usa exactsKnockout como gatilho; passa 0 (sinal disponível,
  // não gating). Se uma persona futura precisar, incluir `stage` no select e contar.
  const exactsKnockout = 0;

  const zebraCandidates: ZebraCandidate[] = rows.map((r) => ({
    homeCode: r.matches.home_team.code, awayCode: r.matches.away_team.code,
    homeName: r.matches.home_team.name, awayName: r.matches.away_team.name,
    tier: r.tier, points: r.points,
  }));
  const zebra = pickZebra(zebraCandidates);

  const retro = buildRetrospectiva({
    highlights: raioX.highlights,
    timeline: raioX.timeline,
    exactsKnockout,
    winnerOrDrawTotal,
    predictionsScored,
    zebra,
    collective: {
      players: playersCount.count ?? 0,
      predictions: predsCount.count ?? 0,
      exacts: groupExactsCount.count ?? 0,
      matches: COMPETITION.totalMatches,
      days: raioX.timeline.length || 39,
    },
    hasData: raioX.hasData,
  });

  return {
    ...retro,
    user: {
      displayName: profile.data!.display_name,
      avatarDataUrl: await toDataUrl(profile.data!.avatar_url),
    },
  };
}
```

> **Nota:** os selects de join (`matches!inner(...)`, `home_team:home_team_id(code,name)`) devem espelhar o padrão já usado em `raio-x.ts`/`queries.ts`. Validar os nomes exatos ao codar. Usar `isZebraProne` importado de `retro-core` para `zebraHits` (não deixar `true` placeholder).

- [ ] **Step 2: Type-check / lint**

Run: `npm run lint`
Expected: sem erros no arquivo novo.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring/retro.ts
git commit -m "feat(retrospectiva): loader server-only (raio-x + coletivo + zebra + avatar inline)"
```

---

## Task 7: `ShareCard` — o card 9:16 (markup determinístico)

Card com **cores da marca hardcoded** (hex, **não** tokens/oklch nem dark mode) — evita problemas do `html-to-image` com `oklch`/CSS vars e garante saída idêntica. Renderizado a 1080×1920 lógico (ex.: `w-[540px] h-[960px]` a `scale/pixelRatio=2`).

**Files:**
- Create: `src/app/(authenticated)/retrospectiva/_components/share-card.tsx`
- Referência: `getInitials` de `_components/avatar-fallback.tsx`.

- [ ] **Step 1: Ler o guia de componentes**

Ler `node_modules/next/dist/docs/` (Server/Client Components, `next/image`) conforme `AGENTS.md`.

- [ ] **Step 2: Implementar o `ShareCard`**

Props: `{ persona, journey, zebra, user, brandTagline }`. Server component (sem interatividade). Requisitos:
- Container com `ref` alvo do snapshot: dimensão fixa 9:16, `overflow-hidden`, `id="retro-share-card"`.
- Cores hardcoded (aprox. da marca): vermelho `#D5372B`, dourado `#F2C14E`, tinta `#1A1410`, creme `#FAF7F2`. Gradiente vermelho→tinta de fundo, faixa dourada de destaque. **Ajustar visualmente** contra `globals.css`.
- Blocos: topo (wordmark BistekaBet + "Retrospectiva Copa 2026") · usuário (avatar `<img src={avatarDataUrl}>` ou iniciais) · **persona** (emoji grande + título `font-heading uppercase` + subtítulo) · grid 2×2 de números (Posição `#X/N`, Pontos, Na mosca, Maior subida — ou a zebra) · tagline · rodapé (`bistekabet · #RumoAoHexa` + URL).
- Fonte: usar a `font-heading` (Anton) já disponível; garantir carregada (Task 8 cuida do `document.fonts.ready`).
- Sem dependências de tema: não usar classes que mudam no dark (`bg-background` etc.) — cor literal.

- [ ] **Step 3: Verificação visual**

Renderizar temporariamente numa rota de dev ou via a página (Task 10). Conferir proporção e legibilidade a 9:16. (Sem teste unitário.)

- [ ] **Step 4: Commit**

```bash
git add src/app/(authenticated)/retrospectiva/_components/share-card.tsx
git commit -m "feat(retrospectiva): ShareCard 9:16 com cores da marca hardcoded"
```

---

## Task 8: `ShareActions` — ilha client (html-to-image)

**Files:**
- Create: `src/app/(authenticated)/retrospectiva/_components/share-actions.tsx`

- [ ] **Step 1: Implementar a ilha**

```tsx
"use client";
import { useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const TARGET_W = 1080;

export function ShareActions({ cardId, fileName }: { cardId: string; fileName: string }) {
  const [busy, setBusy] = useState(false);

  async function render(): Promise<Blob | null> {
    const node = document.getElementById(cardId);
    if (!node) return null;
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    const pixelRatio = TARGET_W / node.offsetWidth; // atinge 1080 de largura
    const dataUrl = await toPng(node, { pixelRatio, cacheBust: true });
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  async function onDownload() {
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) throw new Error("card não encontrado");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não consegui gerar a imagem. Tente um print da tela.");
    } finally { setBusy(false); }
  }

  async function onShare() {
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) throw new Error("card não encontrado");
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Minha Retrospectiva BistekaBet" });
      } else {
        await onDownload();
      }
    } catch {
      /* usuário cancelou ou sem suporte: silencioso */
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={onShare} disabled={busy}>
        {busy ? "Gerando…" : "Compartilhar"}
      </Button>
      <Button variant="outline" onClick={onDownload} disabled={busy}>
        Baixar imagem
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Dica: o Instagram não recebe direto da web — baixe/compartilhe e suba nos seus Stories.
      </p>
    </div>
  );
}
```

> Confirmar o import/variantes do `Button` (shadcn/base-ui) e que `sonner` `<Toaster/>` está montado no layout.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/retrospectiva/_components/share-actions.tsx
git commit -m "feat(retrospectiva): ShareActions (baixar/compartilhar via html-to-image)"
```

---

## Task 9: Seções narrativas + estado vazio

Componentes de apresentação (server), exceto o sparkline (ilha). Reaproveitar padrões de `raio-x/_components` (Card, tipografia `font-heading`, `tabular-nums`).

**Files (criar):**
- `retro-hero.tsx`, `retro-collective.tsx`, `retro-journey.tsx`,
  `retro-rank-sparkline.tsx` (ilha `"use client"`), `retro-zebra.tsx`,
  `retro-persona-reveal.tsx`, `retro-closing.tsx`, `retro-empty.tsx`

- [ ] **Step 1: `retro-rank-sparkline.tsx`** — adaptar `rank-timeline-chart.tsx` (mesmo padrão `useHydrated` + recharts, YAxis `reversed`), versão compacta (altura ~160px, sem eixos densos). Props: `timeline`.

- [ ] **Step 2: Demais seções** — cada uma recebe as props do `Retrospectiva`/`journey`/`collective`/`zebra`/`persona`. Copy conforme spec:
  - `RetroHero`: "Sua Copa 2026 no BistekaBet" + nome/avatar + "39 dias. 104 jogos. 1 bolão entre amigos."
  - `RetroCollective`: números grandes do grupo.
  - `RetroJourney`: números pessoais + `<RetroRankSparkline/>`.
  - `RetroZebra`: destaque do jogo (bandeiras via emoji/inicial ou SVG local; fallback frase se `zebra=null`).
  - `RetroPersonaReveal`: "Você é:" + emoji + título + subtítulo + `reason`.
  - `RetroClosing`: mensagem Brasil/Hexa (copy da Task 1) + CTA que rola até o card.
  - `RetroEmpty`: usado quando `!hasData` para esconder seções competitivas.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/(authenticated)/retrospectiva/_components/
git commit -m "feat(retrospectiva): secoes narrativas + sparkline + estado vazio"
```

---

## Task 10: Página `retrospectiva/page.tsx`

**Files:**
- Create: `src/app/(authenticated)/retrospectiva/page.tsx`
- Referência de padrão: `raio-x/page.tsx` (auth + redirect + load + render).

- [ ] **Step 1: Ler o guia de páginas** em `node_modules/next/dist/docs/` (App Router, `redirect`, RSC async).

- [ ] **Step 2: Implementar a página**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRetrospectiva } from "@/lib/scoring/retro";
import { RetroHero } from "./_components/retro-hero";
import { RetroCollective } from "./_components/retro-collective";
import { RetroJourney } from "./_components/retro-journey";
import { RetroZebra } from "./_components/retro-zebra";
import { RetroPersonaReveal } from "./_components/retro-persona-reveal";
import { RetroClosing } from "./_components/retro-closing";
import { ShareCard } from "./_components/share-card";
import { ShareActions } from "./_components/share-actions";

export default async function RetrospectivaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const retro = await loadRetrospectiva(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-16 px-6 py-12">
      <RetroHero user={retro.user} />
      <RetroCollective collective={retro.collective} />
      {retro.hasData && (
        <>
          <RetroJourney journey={retro.journey} timeline={retro.timeline} />
          <RetroZebra zebra={retro.zebra} />
          <RetroPersonaReveal persona={retro.persona} />
        </>
      )}
      <RetroClosing persona={retro.persona} />
      <section className="flex flex-col items-center gap-6">
        <ShareCard
          persona={retro.persona}
          journey={retro.journey}
          zebra={retro.zebra}
          user={retro.user}
        />
        <ShareActions cardId="retro-share-card" fileName="minha-copa-bistekabet.png" />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Rodar o app e conferir a página**

Run: `npm run dev` → abrir `/retrospectiva` logado.
Expected: página monta, card aparece, sem erros no console.

- [ ] **Step 4: Commit**

```bash
git add src/app/(authenticated)/retrospectiva/page.tsx
git commit -m "feat(retrospectiva): pagina que monta as secoes + card"
```

---

## Task 11: Navegação e entradas (menu, banner na home, link no raio-x)

**Files:**
- Modify: `src/app/(authenticated)/_components/auth-header.tsx`
- Create: `src/app/(authenticated)/inicio/_components/retro-banner.tsx`
- Modify: `src/app/(authenticated)/inicio/page.tsx`
- Modify: `src/app/(authenticated)/raio-x/page.tsx` (ou header do raio-x)

- [ ] **Step 1: Item no menu** — em `auth-header.tsx`, adicionar ao array `NAV`:

```ts
{ href: "/retrospectiva", label: "Retrospectiva" },
```

- [ ] **Step 2: Banner na home** — criar `retro-banner.tsx` (CTA de destaque "Sua Copa acabou — veja sua Retrospectiva" com `Link href="/retrospectiva"`) e inseri-lo em `inicio/page.tsx` acima da `section` do grid.

- [ ] **Step 3: Link no raio-x** — adicionar link "Veja sua Retrospectiva completa" no header do `/raio-x`.

- [ ] **Step 4: Lint + conferência visual**

Run: `npm run lint`
Expected: sem erros. Menu (desktop+mobile), banner e link aparecem e navegam.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authenticated\)/_components/auth-header.tsx \
        src/app/\(authenticated\)/inicio/ \
        src/app/\(authenticated\)/raio-x/page.tsx
git commit -m "feat(retrospectiva): entradas (menu, banner na home, link no raio-x)"
```

---

## Task 12: Verificação final (manual + suíte)

**Files:** nenhum (ou pequenos ajustes de bug encontrados).

- [ ] **Step 1: Suíte completa**

Run: `npm run test`
Expected: PASS (incluindo `personas.test.ts` e `retro-core.test.ts`).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Verificar geração do PNG (risco `oklch`)** — no `/retrospectiva`, clicar **Baixar imagem**. Conferir: PNG sai em ~1080×1920, cores corretas (se `oklch`/vars vazarem e quebrarem, garantir que o `ShareCard` usa só hex — ver Task 7), avatar/iniciais e fonte Anton presentes.

- [ ] **Step 4: Web Share** — em mobile (ou emulação), **Compartilhar** abre a folha do sistema com o arquivo; desktop cai no download.

- [ ] **Step 5: Casos de borda** — usuário **sem dados** (`hasData=false`): só coletivo + despedida + persona "Fiel de Torcida", sem seções competitivas e sem "último colocado". Avatar ausente → iniciais. Zebra ausente → frase carinhosa.

- [ ] **Step 6: Commit (se houve ajustes)**

```bash
git add -A
git commit -m "fix(retrospectiva): ajustes da verificacao final"
```

---

## Notas de decisão

- **Cores hardcoded no ShareCard:** `html-to-image` pode falhar com `oklch`/CSS custom properties; o card é um artefato de marca (não deve reagir a tema). Hex fixos = saída determinística. Verificação explícita na Task 12.
- **Testes contra constantes (não literais):** os limiares de persona vivem em `PERSONA_THRESHOLDS`; os testes referenciam essas constantes, então a calibração da Task 1 não quebra a suíte.
- **`hasData=false` força fallback:** garante que ninguém receba persona competitiva nem enquadramento negativo sem dados.
- **Coletivo via count queries:** respeita o teto de 1000 do PostgREST.
- **Reuso do `loadRaioX`:** rank/pontos/na mosca batem exatamente com Classificação e Raio-X (fonte única de verdade).
