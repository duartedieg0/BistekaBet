# SP-07 Premiação (highlight do pódio) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Destacar visualmente os 3 primeiros colocados no `<RankingTable>` (medalha colorida) e adicionar linha de rodapé apontando o regulamento da premiação. Mudança em um único arquivo.

**Architecture:** Componente local `RankCell` em `ranking-table.tsx` mapeia `rank ∈ {1,2,3}` para ícone `Medal` da `lucide-react` colorido (ouro/prata/bronze). Como `/inicio#ranking` (RankingPreview) e `/classificacao` reusam `<RankingTable>`, o highlight aparece nos dois automaticamente.

**Tech Stack:** Tailwind v4 · lucide-react · Next.js Link.

**Spec:** `docs/superpowers/specs/2026-05-09-sp07-premiacao-design.md`
**Plano macro:** `docs/superpowers/specs/2026-05-09-plano-macro-regulamento.md`
**Depende de:** SP-03 (`RankingTable` existe e é usado em duas superfícies).

**Notas para o executor:**
- npm. TS strict.
- `lucide-react` já é dep; `Medal` disponível.
- Sem migrations, sem testes vitest, sem deps novas.
- Único arquivo modificado.

---

## File Structure

**Modificar:**
- `src/app/(authenticated)/inicio/_components/ranking-table.tsx` — adicionar `RankCell`, substituir célula de rank, adicionar rodapé.

---

## Task 1: Highlight do pódio + rodapé

**Files:**
- Modify: `src/app/(authenticated)/inicio/_components/ranking-table.tsx`

- [ ] **Step 1: Substituir o conteúdo do arquivo**

Conteúdo final completo:

```tsx
import Link from "next/link";
import { Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RankingRow } from "@/lib/scoring/ranking-core";

const MEDAL_COLORS: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-gray-400",
  3: "text-amber-700",
};

function RankCell({ rank }: { rank: number }) {
  const color = MEDAL_COLORS[rank];
  if (!color) {
    return <span className="font-semibold tabular-nums">{rank}</span>;
  }
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <Medal className={`size-4 ${color}`} aria-hidden />
      <span className="font-semibold tabular-nums">{rank}</span>
    </span>
  );
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        A classificação aparecerá aqui assim que os primeiros resultados forem
        registrados.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Participante</TableHead>
            <TableHead className="w-24 text-center">Status</TableHead>
            <TableHead className="w-20 text-right">Pontos</TableHead>
            <TableHead className="w-20 text-right">Exatos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.user_id}>
              <TableCell className="text-right">
                <RankCell rank={r.rank} />
              </TableCell>
              <TableCell className="font-medium">{r.display_name}</TableCell>
              <TableCell className="text-center">
                {r.paid ? (
                  <Badge>Pago</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Pendente
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.total_points}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.exacts_total}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">
        Top 3 levam 1 camisa da Seleção Brasileira.{" "}
        <Link
          href="/regulamento#premiacao"
          className="underline hover:text-foreground"
        >
          Ver premiação no regulamento
        </Link>
        .
      </p>
    </>
  );
}
```

- [ ] **Step 2: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Esperado: ambos limpos.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/inicio/_components/ranking-table.tsx"
git commit -m "feat(ranking): highlight top 3 with medals + premiação footer"
```

---

## Task 2: Verificação final + smoke E2E

**Files:** nenhum.

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Esperado: ≥ **82 tests passing** (sem novos).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Esperado: nenhum erro novo em `ranking-table.tsx`.

- [ ] **Step 3: Smoke E2E manual**

Pré-requisitos: ao menos 3 participantes pontuados (ou ranks compartilhados a partir de empate).

1. Acessar `/classificacao` — top 3 mostram ícone `Medal`:
   - 1º amarelo (`text-yellow-500`)
   - 2º cinza (`text-gray-400`)
   - 3º âmbar/marrom (`text-amber-700`)
2. 4º em diante mostra apenas o número, sem ícone.
3. Linha de rodapé "Top 3 levam 1 camisa da Seleção Brasileira. Ver premiação no regulamento" — link navega para `/regulamento#premiacao` (deve abrir já na seção de premiação).
4. Acessar `/inicio` — mesmo highlight no top-10 do `RankingPreview`.
5. Forçar empate manual (Studio: dois usuários com mesmo `total_points` e mesmos tiebreakers): ranks `1, 2, 2, 4` → ambos os "2" recebem ícone prata; "4" sem ícone.
6. Dark mode (se houver toggle): cores das medalhas continuam visíveis. Se contraste estiver baixo, abrir uma issue para ajustar com variantes `dark:text-...` em iteração futura.
7. Mobile (largura ≤ 380px): linha de rodapé pode quebrar em duas linhas; layout não estoura.

- [ ] **Step 4: Sem regressões**

Visitar `/admin`, `/admin/usuarios`, `/admin/partidas`, `/palpites`, `/regulamento` — carregam normalmente.

---

## Done criteria

- [x] `RankCell` componente local mapeando rank → ícone colorido para 1, 2, 3.
- [x] Demais ranks mostram apenas número.
- [x] Linha de rodapé com link para `/regulamento#premiacao`.
- [x] Highlight aparece em `/inicio` e `/classificacao` simultaneamente (sem mudanças nas páginas).
- [x] `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run lint` passam.
- [x] Smoke E2E manual concluído.
