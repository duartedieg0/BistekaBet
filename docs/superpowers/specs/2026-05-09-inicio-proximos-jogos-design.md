# Redesenho do bloco "Seus próximos jogos" na página /inicio

**Data:** 2026-05-09
**Escopo:** Substituir o card mockado "Seus próximos jogos" em `src/app/(authenticated)/inicio/page.tsx` por um bloco real com duas abas: **Próximos jogos** (palpites do dia) e **Jogos ao vivo** (mock por enquanto).

## Contexto

A página `/inicio` foi feita inteira mockada no início do projeto. Hoje já existem todas as funcionalidades de palpites (`/palpites`) e classificação (`/classificacao`), com `MatchPredictionCard` já maduro: inputs de placar, validação, mata-mata, `savePrediction`, lock automático quando `kickoff_at <= now`.

Este spec cobre apenas o card "Seus próximos jogos". Os demais blocos da home (`Sua posição`, `Aposta da rodada`, `RankingPreview`, header) permanecem inalterados.

## Decisões

- **Reutilizar `MatchPredictionCard`** importando direto de `(authenticated)/palpites/_components/match-prediction-card.tsx`. Não extrair para shared agora.
- **"Dia" calculado em `America/Sao_Paulo`** (público do bolão é BR; consistência entre usuários).
- **Mostrar todos os jogos do dia**, inclusive iniciados/encerrados — o card já trata o estado fechado.
- **Aba default dinâmica**: se há jogos ao vivo → "Ao vivo"; senão → "Próximos jogos".
- **Manter grid `2fr_1fr`** existente; cards laterais intactos.

## Arquitetura

```
src/app/(authenticated)/inicio/
  page.tsx                           # ajustado: substitui o Card antigo pelo novo bloco
  _components/
    upcoming-matches-section.tsx     # server: busca matches do dia em SP, monta props
    inicio-matches-tabs.tsx          # client: Tabs shadcn, controla aba ativa default
    upcoming-matches-list.tsx        # renderiza MatchPredictionCard[] + day label
    live-matches-mock.tsx            # client: array hardcoded + UI ao vivo
```

### `UpcomingMatchesSection` (server)

Responsável por:

1. Calcular `today` em `America/Sao_Paulo` (usar `Intl.DateTimeFormat` com `timeZone` ou helper compartilhado se já existir; **não** depender do TZ do servidor Vercel).
2. Buscar partidas com `kickoff_at` entre `start-of-day-SP` e `end-of-day-SP` (UTC), incluindo as predictions do usuário autenticado para cada match (mesmo padrão usado em `/palpites`).
3. Se vazio, buscar o menor `kickoff_at >= now()` e re-buscar todos os matches do dia (em SP) daquela partida.
4. Passar `{ matches, dayLabel, isToday }` ao `InicioMatchesTabs`.

`dayLabel`:
- Se `isToday`: `"Hoje · 12 jun"`.
- Caso contrário: `"sex, 13 jun"` (formato curto pt-BR).

Se a busca não retornar nenhum match em todo o futuro, passar `matches: []` e `dayLabel: null`. O list renderiza empty state ("Sem jogos agendados ainda.").

### `InicioMatchesTabs` (client)

- `Tabs` shadcn com dois `TabsTrigger`: "Próximos jogos" e "Ao vivo".
- Aba default (calculada no client após hidratação para evitar mismatch SSR): se `liveMatchesCount > 0` → `"live"`; senão `"upcoming"`. Pode ser implementado com `useState(initialTab)` calculado em mount via `useEffect` ou com prop `defaultValue` resolvida no server (sem mismatch porque `liveMatchesCount` vem do mock estático e é determinístico).
- Quando o "ao vivo" virar dinâmico, essa lógica continua funcionando sem mudança.

### `UpcomingMatchesList`

- Header simples com `dayLabel` e contador (ex: "3 abertos" baseado em `matches.filter(m => kickoff > now).length`).
- Mapeia `matches.map(m => <MatchPredictionCard key={m.id} match={m} />)`.
- Empty state quando `matches.length === 0`.

### `LiveMatchesMock` (client)

```ts
type MockLiveMatch = {
  id: string;
  home: { code: string; name: string };
  away: { code: string; name: string };
  homeScore: number;
  awayScore: number;
  minute: string;          // "67'", "Intervalo"
  period: "1T" | "INT" | "2T" | "PRO" | "PEN";
};

const MOCK_LIVE: MockLiveMatch[] = [
  { id: "mock-1",
    home: { code: "BRA", name: "Brasil" },
    away: { code: "ARG", name: "Argentina" },
    homeScore: 2, awayScore: 1, minute: "67'", period: "2T" },
];
```

Visual:
- Badge vermelho com ponto pulsante: "AO VIVO".
- Placar grande, bandeiras (mesmo helper `flagSrc` usado nos demais cards), minuto/status.
- Empty state quando `MOCK_LIVE.length === 0`: ícone + texto "Nenhum jogo rolando agora".

Sem chamadas de rede, sem props de servidor. Quando a integração real for criada, a forma do tipo já está definida.

## Fluxo de dados

```
page.tsx
 └─ UpcomingMatchesSection (server)
     ├─ resolve "dia em SP" → range UTC
     ├─ supabase: matches + user_predictions no range
     └─ render <InicioMatchesTabs matches=… dayLabel=… liveCount={MOCK_LIVE.length} />
            ├─ tab "upcoming" → <UpcomingMatchesList matches dayLabel />
            │      └─ <MatchPredictionCard /> reutilizado
            └─ tab "live" → <LiveMatchesMock />
```

## Reuso do `MatchPredictionCard`

- Importação cross-rota: `import { MatchPredictionCard } from "@/app/(authenticated)/palpites/_components/match-prediction-card"`.
- O componente já cobre: input de placar, validação, regra de mata-mata, `savePrediction`, lock por `kickoff_at`, estado salvo/sujo, badges.
- **Não** envolver em `GroupSaveForm` — a home salva por partida individual, comportamento já default do card sem o contexto de grupo.

## Date helpers

Verificar se já existe um util para calcular dia em SP no projeto. Se não, criar `src/lib/dates/sao-paulo-day.ts` com:

- `saoPauloDayRange(date = new Date()): { startUtc: Date; endUtc: Date }`.
- `formatSaoPauloDayLabel(date: Date, opts?: { isToday?: boolean }): string`.

Implementação com `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", … })` para extrair YYYY-MM-DD do dia em SP, depois reconstruir os limites em UTC.

## Testes

- Unit do helper de dia em SP: midnight crossings, horário de verão (não há mais no Brasil, mas garantir).
- Unit/integration de `UpcomingMatchesSection`:
  - Há jogos hoje → retorna esses.
  - Sem jogos hoje, há nos próximos dias → retorna do próximo dia.
  - Sem jogos no futuro → `matches: []`.
- Smoke do `InicioMatchesTabs`: aba default vai pra "live" quando mock não-vazio; vai pra "upcoming" quando mock vazio.

## Acessibilidade / UX

- `Tabs` shadcn já cobre roles/aria.
- Badge "AO VIVO" com `role="status"` e texto não dependente apenas de cor.
- `dayLabel` legível por leitor de tela (não usar abreviações cripticas sem `aria-label`).
- Mantém os tokens visuais atuais (`font-heading`, `text-primary`, `tabular`).

## Fora de escopo

- Cards laterais "Sua posição" e "Aposta da rodada" (continuam mockados).
- Header da página, badge "Pré-Copa", `RankingPreview`.
- Integração real de "Jogos ao vivo" — futura, terá spec próprio.
- Refactor para extrair `MatchPredictionCard` para `src/components/`.

## Riscos

- **Importar componente cross-rota** entre `(authenticated)/palpites/...` e `(authenticated)/inicio/...` é apenas um import TS — sem risco real, mas vale ter ciente que se palpites mudar a assinatura, a home quebra. Mitigação: tests cobrindo a home.
- **Lógica de fuso** é fonte clássica de bug. Helper isolado e testado mitiga.
