# Palpites — Toggle "Jogos por data" / "Tabela de jogos"

**Data:** 2026-06-12
**Tela afetada:** `/palpites`

## Contexto

A tela `/palpites` hoje exibe o `<h1>` "Tabela de jogos" seguido do `StageTabs` (fase + grupos) e dos `MatchPredictionCard` envolvidos por um `GroupSaveForm`. O usuário só consegue navegar por fase → grupo, o que dificulta encontrar jogos do dia.

## Objetivo

Adicionar uma segunda visualização — **Jogos por data** — que se torna o **modo padrão** da tela. O usuário alterna entre os dois modos clicando nos próprios títulos, que viram botões.

## Modos de visualização

### Jogos por data (padrão)
- Mostra os jogos de **uma única data** selecionada.
- Lista de datas (com contagem) é apresentada no topo como cards horizontais com scroll.
- Default: data de hoje em **America/Sao_Paulo**.
- Se a data não tiver jogos, mostra empty state e mantém o seletor de datas visível.

### Tabela de jogos
- Comportamento atual preservado: `StageTabs` (fase) + chips de grupo.

## URL & estado

| Modo | Query string |
|------|--------------|
| Jogos por data | `?view=date&date=YYYY-MM-DD` |
| Tabela de jogos | `?stage=<stage>&group=<code>` (atual) |

Regras de default no server component:
- `view` ausente e `stage` ausente → `view=date` + `date=todayInSaoPaulo()`.
- `view=date` sem `date` → `date=todayInSaoPaulo()`.
- Click em "Tabela de jogos" → navega para `?stage=group&group=A`.
- Click em "Jogos por data" → navega para `?view=date&date=<hoje>`.

## UI

### Header (substitui o `<h1>` atual)

Dois botões com a mesma tipografia do h1 atual (`font-heading text-4xl sm:text-5xl uppercase tracking-tight`), lado a lado, separados por `·`:

```
JOGOS POR DATA   ·   Tabela de jogos
```

- Ativo: cor sólida (`text-foreground` ou cor primária).
- Inativo: `opacity-40 text-muted-foreground`, `cursor-pointer`.
- Elementos: `<button>` com `aria-pressed`, navegação via `router.push`.
- Mobile: `flex-wrap` — se não couber, quebra em 2 linhas.
- Eyebrow "SEUS PALPITES" e subtítulo "Faça seus palpites." permanecem.
- Badge `savedCount/total · totalPts` à direita continua refletindo apenas os jogos visíveis.

### Seletor de datas (`DateNav`)

Substitui o `StageTabs` quando `view === "date"`. Linha horizontal com `overflow-x-auto`, cada item é um card clicável:

```
┌──────────────┐   ┌──────────────┐
│  qui  11/06  │   │  sex  12/06  │   ...
│   4 jogos    │   │   3 jogos    │
└──────────────┘   └──────────────┘
```

- Cada card: `w-28`, `rounded-lg`, `border`, `px-3 py-2`, `shrink-0`.
- Linha 1: dia da semana abreviado (pt-BR) + `DD/MM` em mono.
- Linha 2: `N jogos` em `text-xs text-muted-foreground` (`/80` no ativo).
- Ativo: `bg-primary text-primary-foreground`. Inativo: `outline`.
- Cada card é `<Link href="/palpites?view=date&date=YYYY-MM-DD">`.
- Ao montar, o card ativo recebe `scrollIntoView({ inline: 'center', behavior: 'instant' })`.
- Lista contém **todas** as datas com pelo menos 1 jogo, independente de fase.

### Lista de jogos

- Server-side filter: `kickoff_at` cai no dia selecionado (em America/Sao_Paulo).
- Ordem: `kickoff_at` crescente.
- Renderização: mesmos `MatchPredictionCard` dentro do mesmo `GroupSaveForm` — sem mudança nesses componentes.
- Sticky "Salvar palpites" funciona normalmente para os jogos visíveis daquela data.

### Estado vazio

- **Data selecionada sem jogos:** card "Nenhum jogo neste dia / Escolha outra data acima." `DateNav` permanece visível.
- **Nenhum jogo cadastrado em todo o torneio:** esconde `DateNav` e mostra o empty state existente ("Nenhum jogo no forno / Os jogos aparecem aqui assim que a tabela da Copa 2026 for publicada.").

## Estrutura de arquivos

```
src/app/(authenticated)/palpites/
├── page.tsx                              (modificado)
├── _components/
│   ├── view-toggle.tsx                   (NOVO)
│   ├── date-nav.tsx                      (NOVO)
│   ├── stage-tabs.tsx                    (sem mudança)
│   ├── match-prediction-card.tsx         (sem mudança)
│   └── group-save-form.tsx               (sem mudança)
└── _lib/
    ├── queries.ts                        (sem mudança)
    └── date-buckets.ts                   (NOVO)
```

### `_lib/date-buckets.ts`

Utilitário puro, sem libs externas:

- `todayInSaoPaulo(): string` — retorna `YYYY-MM-DD` da data atual em America/Sao_Paulo. Usa `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`.
- `toSaoPauloDate(kickoffAt: string): string` — converte um ISO UTC para `YYYY-MM-DD` em SP.
- `bucketMatchesByDate(matches): Array<{ date: string; count: number }>` — agrupa por dia SP, ordenado crescente.
- `filterMatchesByDate(matches, date): typeof matches` — subset cujo `toSaoPauloDate(m.kickoff_at) === date`.

### `_components/view-toggle.tsx` (client)

Recebe `active: "date" | "table"` e `defaultDate: string`. Renderiza os dois botões; ao clicar no inativo, faz `router.push` para o default do outro modo.

### `_components/date-nav.tsx` (client)

Recebe `buckets: Array<{ date: string; count: number }>` e `active: string`. Renderiza scroll horizontal de cards. Em `useEffect`, faz `scrollIntoView` no card ativo.

### `page.tsx`

```typescript
const view: "date" | "table" =
  sp.view === "date" || (!sp.view && !sp.stage) ? "date" : "table";

if (view === "date") {
  const date = sp.date ?? todayInSaoPaulo();
  const buckets = bucketMatchesByDate(all);
  const filtered = filterMatchesByDate(all, date)
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
  // render ViewToggle + DateNav (se buckets.length > 0) + lista/empty
} else {
  // comportamento atual: StageTabs + filtro por stage/group
}
```

## Testes

### Unitários (`date-buckets.test.ts`)

- `todayInSaoPaulo()` retorna formato `YYYY-MM-DD` válido.
- `toSaoPauloDate` para jogo às 23:00 SP (02:00 UTC do dia seguinte) → cai no dia SP correto.
- `bucketMatchesByDate` agrupa corretamente; ordem cronológica.
- `filterMatchesByDate` consistente com `bucketMatchesByDate`.

### Validação manual (browser)

- `/palpites` sem query → `view=date&date=<hoje>`.
- Toggle "Tabela de jogos" → URL `?stage=group&group=A`, tabs+grupos voltam.
- Toggle "Jogos por data" → reseta para hoje.
- URL manual com data sem jogos → empty state + `DateNav` visível.
- Mobile: títulos quebram em 2 linhas, scroll horizontal funciona, card ativo centralizado.

## Edge cases

- `kickoff_at` deve ser `timestamptz` no Postgres — confirmar antes de implementar; se for `timestamp` sem tz, o cálculo SP fica errado.
- Datas que cruzam meia-noite SP por causa do UTC: resolvido pelo uso de `Intl.DateTimeFormat` com `timeZone`.
- Não há fallback automático para outra data: comportamento explícito por decisão do usuário (resposta B na fase de design).
