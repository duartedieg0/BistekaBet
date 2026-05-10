# SP-07 · Premiação — Design

**Data:** 2026-05-09
**Plano macro:** [`2026-05-09-plano-macro-regulamento.md`](./2026-05-09-plano-macro-regulamento.md)
**Depende de:** SP-03 (`RankingTable`).
**Cláusulas cobertas:** §13 (visual), §14 (regulamento). Regras já documentadas em SP-06.

---

## 1. Objetivo

Destacar visualmente os 3 primeiros colocados no `<RankingTable>` com ícone de
medalha colorido (ouro / prata / bronze) e adicionar uma linha discreta de
rodapé apontando o regulamento. Sem cálculo de prêmio em dinheiro, sem
configuração admin nova, sem página dedicada.

## 2. Não-objetivos

- Tabela de configuração de premiação (`bolao_config`) — descartado em P1.
- Página `/premiacao` dedicada — descartado em P2.
- Card "Premiação" separado em `/inicio` — descartado em P2.
- Cálculo dinâmico de bolo arrecadado/líquido em UI — decisão de não comunicar desconto de camisas.
- Visual pós-torneio (vencedor final) — fora do escopo.

## 3. Decisões de design

| ID | Decisão | Justificativa |
|---|---|---|
| Q1 | Constantes em código (R$ 75 inscrição, 3 premiados, 50/35/15) | §14 prevê alteração antes do início, não contínua; sem infraestrutura nova |
| Q2 | UI mostra apenas highlight do pódio + link para regulamento | Comunicação minimalista (sem expor desconto das camisas); regras canônicas em SP-06 |
| Q3 | Highlight: ícone `Medal` da `lucide-react` colorido por posição | Reuso do componente `<RankingTable>` em `/inicio` e `/classificacao` automaticamente |
| Q4 | Cores: ouro `text-yellow-500`, prata `text-gray-400`, bronze `text-amber-700` | Convenção esportiva; legível em ambos os temas |
| Q5 | Empates compartilham medalha (`1, 1, 1, 4` → 3 ouros) | Coerente com `assignRanks` (SP-03); aceitável visualmente |

## 4. Arquitetura

### 4.1 Modificação em `ranking-table.tsx`

Arquivo: `src/app/(authenticated)/inicio/_components/ranking-table.tsx`.

#### Componente local `RankCell`

```tsx
import { Medal } from "lucide-react";

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
```

#### Substituição da célula de rank

```tsx
// Antes:
<TableCell className="text-right font-semibold tabular-nums">
  {r.rank}
</TableCell>

// Depois:
<TableCell className="text-right">
  <RankCell rank={r.rank} />
</TableCell>
```

### 4.2 Linha de rodapé

Após o `</Table>`, antes do fim do componente:

```tsx
<p className="mt-3 text-xs text-muted-foreground">
  Top 3 levam 1 camisa da Seleção Brasileira.{" "}
  <Link href="/regulamento#premiacao" className="underline hover:text-foreground">
    Ver premiação no regulamento
  </Link>
  .
</p>
```

`Link` importado de `next/link`. Renderiza apenas quando `rows.length > 0` (caso vazio já retorna o parágrafo "A classificação aparecerá aqui…").

### 4.3 Acessibilidade

- `<Medal>` com `aria-hidden` — número do rank carrega a info.
- Cor é reforço; ícones têm forma idêntica nas 3 posições.

### 4.4 Aplicação automática

`/inicio#ranking` (`RankingPreview`) e `/classificacao` (`ClassificacaoPage`)
ambos consomem `<RankingTable>` — a mudança aparece nos dois sem trabalho extra.

## 5. Estratégia de testes

- **Sem teste vitest novo.** Lógica de rank já está em `assignRanks` (SP-03). `RankCell` é mapeamento trivial.
- **Smoke E2E manual:**
  1. `/classificacao` com ≥ 3 participantes — top 3 com medalhas coloridas.
  2. `/inicio` — mesmo highlight no preview.
  3. Empate em 2º (`1, 2, 2, 4`) — dois ícones prata; "4" sem ícone.
  4. Rodapé: "Top 3 levam 1 camisa…" + link funcional para `/regulamento#premiacao`.
  5. Dark mode (se houver toggle): contraste das medalhas continua legível.

## 6. Entregáveis

- Modificar **um único arquivo**: `src/app/(authenticated)/inicio/_components/ranking-table.tsx`.

Sem migration, sem novo componente em arquivo separado, sem deps.

## 7. Riscos e questões em aberto

1. **Contraste em dark mode** — verificar visualmente; se necessário usar `dark:text-yellow-400` etc.
2. **Versão de `lucide-react`** — `Medal` disponível desde versões antigas; `^1.14.0` no `package.json` cobre.
3. **Quebra de linha em mobile** — texto do rodapé é `text-xs`; aceitável quebrar em duas linhas.
4. **Empates massivos** — se 5 pessoas empatadas no 1º lugar, todas recebem medalha de ouro; visualmente correto, cenário improvável.

## 8. Encerramento do plano macro

Com SP-07 entregue, todos os 7 sub-projetos previstos no plano macro
(2026-05-09-plano-macro-regulamento.md) estarão completos, cobrindo §1–§16
do regulamento.
