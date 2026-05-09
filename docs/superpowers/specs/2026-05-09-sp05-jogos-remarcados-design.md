# SP-05 · Jogos remarcados — Design

**Data:** 2026-05-09
**Plano macro:** [`2026-05-09-plano-macro-regulamento.md`](./2026-05-09-plano-macro-regulamento.md)
**Depende de:** SP-02 (`prediction_scores` para deletar quando `status='postponed'/'cancelled'`).
**Cláusulas cobertas:** §10.

---

## 1. Objetivo

Quando uma partida é remarcada, preservar o **kickoff original** e exibir um sinal
visual ("Remarcado") em todas as superfícies onde a partida aparece. O fluxo
operacional do admin permanece o mesmo: editar `kickoff_at` no form continua
sendo a forma de remarcar. A semântica de §10 ("palpite continua válido por
padrão; admin reabre se quiser") já é resolvida mecanicamente pela RLS de
`predictions` (gate `kickoff_at > now()`); SP-05 adiciona apenas histórico e
visibilidade.

## 2. Não-objetivos

- Tabela de auditoria completa (`match_history`).
- Operação admin dedicada "Reabrir palpites" (continua sendo edição de `kickoff_at`).
- Notificação a participantes (responsabilidade externa — WhatsApp, e-mail).
- Histórico de N alterações; só guardamos a **primeira** data oficial.

## 3. Decisões de design

| ID | Decisão | Justificativa |
|---|---|---|
| Q1 | Snapshot do kickoff original em coluna `matches.original_kickoff_at` | Preserva histórico mínimo sem nova tabela; valor visual e regulamentar |
| Q2 | Trigger Postgres `before update` popula automaticamente | À prova de bypass (Studio, scripts, qualquer caminho); zero código no app além da migration |
| Q3 | Apenas a **primeira** alteração é capturada (`old.original_kickoff_at is null`) | "Originalmente era…" é o que importa; alterações subsequentes são ajustes do remarcado |
| Q4 | Badge "Remarcado" com `title` mostrando data original (HTML `title` = tooltip nativo) | Visual mínimo, info completa por hover; bom em mobile (`title` aparece em long-press na maioria dos browsers) |
| Q5 | Sem operação admin nova, sem mudança no fluxo de `updateMatch` | Editar `kickoff_at` já tem o efeito desejado; trigger garante o resto |

## 4. Arquitetura

### 4.1 Migration `supabase/sql/010_matches_original_kickoff.sql`

```sql
-- BistekaBet — preservar kickoff original quando partida é remarcada (SP-05).
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

alter table public.matches
  add column original_kickoff_at timestamptz;

create or replace function public.matches_record_original_kickoff()
returns trigger
language plpgsql as $$
begin
  if new.kickoff_at is distinct from old.kickoff_at
     and old.original_kickoff_at is null then
    new.original_kickoff_at := old.kickoff_at;
  end if;
  return new;
end $$;

create trigger matches_record_original_kickoff
  before update on public.matches
  for each row execute function public.matches_record_original_kickoff();
```

- `before update`: precisamos modificar `NEW`.
- `is distinct from`: trata `null` corretamente.
- Coexiste com `matches_set_updated_at` (também `before update`); execução em ordem alfabética do nome — sem conflito.

### 4.2 Tipo `Match`

`src/lib/types/match.ts`:

```ts
export interface Match {
  // ... campos atuais
  original_kickoff_at: string | null; // NOVO
}
```

`MatchWithPrediction extends Match` herda automaticamente. As queries que usam
`select *` (em `getMatchesWithPredictions` e em `/admin/partidas`) puxam o campo
sem mudança.

### 4.3 Componente `RescheduledBadge`

`src/app/(authenticated)/palpites/_components/rescheduled-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function RescheduledBadge({
  originalKickoff,
}: {
  originalKickoff: string | null;
}) {
  if (!originalKickoff) return null;
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground"
      title={`Originalmente: ${fmt(originalKickoff)}`}
    >
      Remarcado
    </Badge>
  );
}
```

Retorna `null` quando `originalKickoff === null` — chamadores sem condicional.

### 4.4 Onde aparece

- **`/palpites` (`MatchPredictionCard`)** — header, ao lado do horário:
  ```tsx
  <CardHeader className="flex flex-row items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium tabular text-muted-foreground">{kickoffLabel}</span>
      <RescheduledBadge originalKickoff={match.original_kickoff_at} />
    </div>
    {statusBadge}
  </CardHeader>
  ```
- **`/admin/partidas` (lista, em `MatchList`)** — célula de horário:
  ```tsx
  <TableCell>
    {new Date(m.kickoff_at).toLocaleString("pt-BR")}{" "}
    <RescheduledBadge originalKickoff={m.original_kickoff_at} />
  </TableCell>
  ```
- **`/admin/partidas/[id]` (form)** — linha somente leitura abaixo do campo `kickoff_at` quando `original_kickoff_at` não é null:
  ```tsx
  {match.original_kickoff_at && (
    <p className="text-xs text-muted-foreground">
      Kickoff original: {new Date(match.original_kickoff_at).toLocaleString("pt-BR")}
    </p>
  )}
  ```

### 4.5 Onde NÃO aparece

- `/inicio`, `/classificacao` — sem relação semântica.
- Bloco encerrado do card (SP-04) — não polui o resultado oficial.

## 5. Estratégia de testes

- **Sem teste vitest novo.** Sem função pura nova; o componente é trivial.
- **Smoke E2E manual:**
  1. Aplicar migração 010.
  2. `/admin/partidas/[id]`: alterar `kickoff_at` e salvar.
  3. Studio: `select kickoff_at, original_kickoff_at from matches where id='...'` retorna o anterior em `original_kickoff_at`.
  4. Alterar `kickoff_at` de novo: `original_kickoff_at` **não** muda.
  5. `/palpites`: badge "Remarcado" + tooltip "Originalmente: …".
  6. `/admin/partidas`: idem na lista.

## 6. Riscos / questões em aberto

1. **`MatchWithTeams` em `match-list.tsx`** — o tipo é definido localmente; precisa adicionar `original_kickoff_at: string | null`. Plano cobre.
2. **`Match` reaproveitado em outros tipos** — `MatchWithPrediction extends Match` herda; `loadRanking` lê `select *` mas não usa o campo. Sem efeito.
3. **Comportamento ao remarcar para uma data anterior à atual** (passar `kickoff_at` para o passado) — RLS continua coerente: `kickoff_at > now()` falso = palpites fechados. Trigger ainda preserva original. Sem caso especial.
4. **Apagar `original_kickoff_at` manualmente no Studio** "reseta" a história — comportamento intencional; admin pode forçar se quiser.

## 7. Como SPs futuros consomem

- **SP-06 (regulamento)**: nada, sem relação.
- **SP-07 (premiação)**: nada, sem relação.
