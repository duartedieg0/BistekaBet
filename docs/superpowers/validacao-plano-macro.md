# Validação completa do plano macro do regulamento

**Cobertura:** SP-01 → SP-07 (§1–§16 do regulamento).
**Pré-requisito:** todos os 7 sub-projetos foram implementados em código (commits na `main`).
**Tempo estimado:** 60–90 minutos para fluxo completo.

> Marque `[x]` em cada item conforme valida. Se algo falhar, anote em "Issues" no final.

---

## Fase 0 — Pré-requisitos de banco

Aplicar manualmente no **Supabase Studio → SQL Editor** (com service role) as
três migrações desta esteira, na ordem:

- [ ] **`supabase/sql/008_prediction_scores.sql`** — tabela `prediction_scores` (SP-02).
- [ ] **`supabase/sql/009_profiles_public_read.sql`** — policy de leitura pública de `profiles` (SP-03).
- [ ] **`supabase/sql/010_matches_original_kickoff.sql`** — coluna + trigger de kickoff original (SP-05).

Conferir no Studio (Table Editor):

- [ ] `public.prediction_scores` existe com 6 colunas e 3 índices.
- [ ] `public.profiles` tem coluna `paid` (SP anterior) e RLS com policy `profiles_select_authenticated`.
- [ ] `public.matches` tem coluna `original_kickoff_at` (timestamptz, null por padrão).

---

## Fase 1 — Setup de dados de teste

Para validação realista, garantir que existam:

- [ ] **3+ usuários cadastrados** com `display_name` legível.
  - Sugestão: você (admin), + 2 contas extras (criadas via signup do app ou via Studio).
- [ ] **1 partida na fase de grupos** (`stage='group'`) com horário **passado** e **resultado lançado** (`home_score`/`away_score` definidos).
- [ ] **1 partida na fase de grupos** com horário **futuro** (palpites abertos).
- [ ] **1 partida em fase eliminatória** (`stage='round_of_32'` ou superior) com resultado lançado.
- [ ] Cada um dos 3 usuários tem **palpite salvo** em pelo menos as partidas com resultado.
- [ ] Pelo menos 1 usuário marcado como `paid=true` (admin toggle em `/admin/usuarios`).

Para rodar a engine pela primeira vez sobre esses dados:

- [ ] Logar como admin → `/admin` → clicar em **"Recalcular pontuações"** → toast verde com totais (X partidas processadas, Y atualizados).
- [ ] No Studio: `select count(*), sum(points) from public.prediction_scores;` → linhas e pontos coerentes.

---

## Fase 2 — SP-01 Scoring engine

Verificação automatizada (sem clicar em UI):

- [ ] Rodar `npm test` no terminal local.
- [ ] Saída: **≥ 82 testes verdes**, 7 arquivos.
- [ ] Saída inclui suite "score() — exemplos numerados do regulamento" com 6 testes nomeados §7.1, §7.2 ex.1, §7.2 ex.2, §7.3, §8 ex.1, §8 ex.2 — todos passando.
- [ ] Saída inclui "POINTS_TABLE (§6 — espelha o regulamento)" com 7 testes (um por fase).

Conferência manual rápida:

- [ ] Abrir `src/lib/scoring/points-table.ts` e comparar valores com a tabela do regulamento §6 — 21 células, todas idênticas.

---

## Fase 3 — SP-02 Materialização de pontos

Como admin:

- [ ] Em `/admin/partidas`, abrir a partida de grupo com resultado.
- [ ] Editar placar (alterar 1 gol em qualquer time) e salvar.
- [ ] No Studio: `select count(*), sum(points) from public.prediction_scores where match_id='<uuid>';` → linhas atualizadas.
- [ ] Reverter o placar para o original e salvar de novo.
- [ ] Re-conferir no Studio: pontos voltaram aos originais (idempotência).

Estado especial — resultado nulo:

- [ ] Editar a mesma partida; **apagar** `home_score` e `away_score`. Salvar.
- [ ] Studio: `select count(*) from prediction_scores where match_id='<uuid>';` → **0** (scores deletados).
- [ ] Voltar a preencher placar e salvar — scores reaparecem.

Estado especial — `cancelled`:

- [ ] Editar a partida; marcar `status='cancelled'` (sem mudar placar). Salvar.
- [ ] Studio: count na `prediction_scores` para essa partida → **0**.
- [ ] Limpar `status` (volta a `null`); placar continua → recalcular tudo no admin → scores voltam.

Botão "Recalcular tudo":

- [ ] `/admin` → botão "Recalcular pontuações" → toast com totais.
- [ ] Studio: total de linhas em `prediction_scores` faz sentido (≤ nº de partidas com resultado × nº de palpites por partida).

---

## Fase 4 — SP-03 Classificação + desempate

Como admin (ou usuário comum logado):

- [ ] Acessar `/classificacao`.
- [ ] Tabela mostra todos os participantes (mesmo os sem palpite — com 0 pts).
- [ ] Coluna **Status**: badge "Pago" para `paid=true`, "Pendente" para `paid=false`.
- [ ] Coluna **#** ordenada decrescente por pontos.
- [ ] Header indica `N participantes`.

Acessar `/inicio`:

- [ ] Seção "Ranking" abaixo dos cards de hero, mostrando top-10.
- [ ] Link "Ver classificação completa →" leva para `/classificacao`.
- [ ] Item "Ranking" do header / sidebar leva direto para `/classificacao`.

Empate forçado (Studio):

- [ ] Editar `prediction_scores` no Studio para colocar dois usuários com mesmo `total_points`, `exacts_total`, etc, OU criar palpites idênticos para dois usuários numa partida resolvida.
- [ ] Recarregar `/classificacao` — os dois compartilham o mesmo `rank` (ex.: `1, 2, 2, 4`).
- [ ] (Reverter ajustes manuais quando terminar.)

---

## Fase 5 — SP-04 Meus palpites com pontos visíveis

Logado como usuário **com palpites salvos**:

- [ ] Acessar `/palpites`. Aba/grupo da partida resolvida.
- [ ] Card da partida encerrada **não está mais opaco** (sem `opacity-60`).
- [ ] Botão "Salvar" **não aparece** no card encerrado.
- [ ] Bloco inferior do card mostra:
  - Texto "Resultado oficial" + placar tempo normal (ex.: "2 × 1").
  - Badge colorida conforme tier:
    - **`+N · Placar exato`** (variant upcoming) para palpite idêntico ao resultado.
    - **`+N · Acertou`** (variant secondary) para vencedor (com ou sem gols).
    - **`0 · Errou`** (variant outline cinza) para palpite incorreto.
- [ ] Header da página: badge `X/Y palpites · Z pts` (Z = soma de pontos da fase/grupo visível).

Estado "Aguardando":

- [ ] Em uma partida com kickoff passado MAS ainda sem resultado lançado: card mostra "Aguardando resultado oficial" + badge "Aguardando".

Estado "Não palpitou" (§3):

- [ ] No Studio, deletar o palpite do usuário corrente em uma partida **encerrada com resultado**:
  ```sql
  delete from public.predictions where user_id='<seu-uuid>' and match_id='<uuid-de-jogo-com-resultado>';
  ```
- [ ] Recarregar `/palpites` na fase/grupo dessa partida.
- [ ] Card mostra "Resultado oficial: …" + badge **`0 · Não palpitou`**.
- [ ] (Restaurar o palpite no Studio se quiser preservar dados de teste.)

Reflexo após admin alterar:

- [ ] Como admin, em `/admin/partidas`, alterar placar de uma partida e salvar.
- [ ] Voltar para `/palpites` (hard refresh) — badge e total refletiram a mudança.

---

## Fase 6 — SP-05 Jogos remarcados

Como admin:

- [ ] Em `/admin/partidas/[id]`, escolher uma partida que **ainda não foi remarcada**.
- [ ] Anotar o `kickoff_at` atual (memorizar/copiar).
- [ ] Alterar `kickoff_at` para outra data/hora futura. Salvar.
- [ ] Voltar para `/admin/partidas` (lista).
- [ ] Célula de horário mostra novo horário **+** badge "Remarcado".
- [ ] Hover (ou long-press em mobile) no badge → tooltip "Originalmente: dd/mm hh:mm" com a data **anterior**.
- [ ] Reabrir o form da mesma partida — abaixo do input "Início", linha cinza "Kickoff original: dd/mm hh:mm".
- [ ] Alterar `kickoff_at` de novo (segunda vez). Salvar.
- [ ] Tooltip continua mostrando a **primeira** data (não a segunda).

No Studio (sanidade):

```sql
select kickoff_at, original_kickoff_at from public.matches where id='<uuid>';
```

- [ ] `original_kickoff_at` = primeira data oficial; `kickoff_at` = data atual.

Em `/palpites`:

- [ ] Acessar a fase/grupo da partida remarcada (logado).
- [ ] Header do card mostra horário + badge "Remarcado" com tooltip.

---

## Fase 7 — SP-06 Página pública de Regulamento

**Deslogado** (abrir aba anônima ou signout):

- [ ] Acessar `http://localhost:3000/regulamento` (ou URL de produção).
- [ ] Página renderiza com header "Regulamento" + sumário (TOC) + 16 seções.
- [ ] TOC: clicar em cada link rola até a seção correspondente; URL muda para `#<id>`.
- [ ] Tabela §6 (Pontuação): 7 linhas, valores idênticos a `docs/regulamento.md`.
- [ ] Tabela §13 (Premiação): 3 linhas, percentuais 50/35/15.
- [ ] Caixas de exemplo (§7.1, §7.2, §7.3, §8) com borda esquerda colorida.
- [ ] Em mobile (≤ 640px), tabelas deslizam horizontalmente sem quebrar layout.

**Logado:**

- [ ] Item "Regulamento" no header (autenticado) → leva para `/regulamento`.
- [ ] Item "Regulamento" na sidebar → idem.

**Landing público (`/`, deslogado):**

- [ ] Footer mostra "Regras oficiais" e "Pontuação" — ambos navegam para `/regulamento` (este último em `/regulamento#pontuacao`).
- [ ] `/regulamento#pontuacao` abre direto na seção §6.

**Conferência cruzada com `docs/regulamento.md`:**

- [ ] Ler `docs/regulamento.md` lado a lado com a página renderizada — todas as 16 cláusulas estão presentes; nenhuma frase chave faltando.

---

## Fase 8 — SP-07 Highlight do pódio

- [ ] Em `/classificacao`, com ≥ 3 participantes pontuados:
  - 1º lugar: ícone `Medal` **dourado** (`text-yellow-500`).
  - 2º lugar: ícone `Medal` **prata** (`text-gray-400`).
  - 3º lugar: ícone `Medal` **bronze** (`text-amber-700`).
- [ ] 4º em diante: apenas o número, sem ícone.
- [ ] Abaixo da tabela, linha cinza pequena: "Top 3 levam 1 camisa da Seleção Brasileira. Ver premiação no regulamento."
- [ ] Clicar "Ver premiação no regulamento" → abre `/regulamento#premiacao`.
- [ ] Em `/inicio`, mesmo highlight no top-10.
- [ ] Empate em 1º/2º/3º: ranks compartilhados recebem todos a mesma medalha (ex.: dois "1" → dois ouros; o "3" pula para "4" sem ícone).

---

## Fase 9 — Regressões e verificações finais

- [ ] Suíte completa: `npm test` → **82/82 verdes**.
- [ ] Typecheck: `npx tsc --noEmit` → limpo.
- [ ] Lint: `npm run lint` → sem **novos** erros (3 erros pré-existentes em `_components/landing/hero.tsx` e `match-prediction-card.tsx` são fora do escopo).
- [ ] Build de produção: `npm run build` → todas as rotas listadas (`/`, `/inicio`, `/palpites`, `/classificacao`, `/regulamento`, `/admin*`).
- [ ] Sem regressões nas páginas existentes:
  - [ ] `/` (landing) carrega.
  - [ ] `/inicio` carrega com seção Ranking nova + cards antigos intactos.
  - [ ] `/palpites` carrega; cards abertos têm botão "Salvar"; cards encerrados têm bloco de pontuação.
  - [ ] `/admin` carrega com KPIs + card "Pontuação".
  - [ ] `/admin/usuarios` carrega; toggle "Pago" funciona.
  - [ ] `/admin/partidas` carrega; lista mostra badge "Remarcado" onde aplicável.
  - [ ] `/admin/times` carrega.

---

## Issues encontradas

> Anote aqui qualquer falha ou comportamento inesperado.

| Fase | O que falhou | Severidade |
|---|---|---|
|   |   |   |

---

## Encerramento

Após todos os checkboxes acima estarem marcados **e** nenhuma issue crítica:

- [ ] Plano macro **validado**. Cobertura de §1–§16 do regulamento confirmada em produção (ou ambiente equivalente).
- [ ] Considerar invocar skill `finishing-a-development-branch` se quiser formalizar o fechamento.
