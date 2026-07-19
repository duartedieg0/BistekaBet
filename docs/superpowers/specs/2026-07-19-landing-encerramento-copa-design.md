# Landing de Encerramento da Copa — Retrospectiva pública — Design

**Data:** 2026-07-19
**Página alvo:** `/` (home pública), quando a flag `copa_encerrada` estiver ligada e o visitante estiver deslogado.
**Depende de:**
- `loadRanking()`/`aggregate()` (SP-03) → `RankingRow[]` ordenado, com `rank`, `avatar_url`, `display_name`, `total_points`, `exacts_total`.
- Padrão de flag `app_settings` + `getAppSetting`/`setAppSetting` e o par `EventInviteToggleCard`/`setEventInviteEnabled` (modal de convite de evento) como molde.
- Componentes `RankingPodium` e `RankingList` (`/classificacao`).

---

## 1. Objetivo

Uma **segunda versão da landing** (`/`) para quando a Copa terminar, acionada
manualmente pelo admin. Substitui a home pré-torneio por uma **retrospectiva
imersiva de encerramento**: coroação do campeão, pódio, números coletivos do
bolão e a classificação final completa. Objetivo de produto: prender o visitante
deslogado e convertê-lo em login para ver a **retrospectiva pessoal** que já
existe (`/retrospectiva`).

Mantém a linguagem de marca do Hero atual, **incluindo os dois logos** (mascote
`BISTECA.png` + `logo_coringas.png`).

## 2. Não-objetivos

- **Não** altera o app autenticado. Quem está logado continua sendo redirecionado
  de `/` para `/inicio` (comportamento atual intacto). A landing de encerramento é
  vista **somente por visitante anônimo**.
- **Não** cria rota nova nem redirect. É render condicional dentro de `/`
  (Abordagem A). Sem `/retrospectiva-copa`.
- **Não** mexe na matemática de ranking/desempate (`ranking-core.ts`) nem em
  `loadRanking()`.
- **Não** cria agregações/superlativos novos (jogo mais cravado, maior zebra
  coletiva, etc.). A retrospectiva coletiva usa **apenas dados já calculados**:
  ranking + contadores coletivos.
- **Não** exibe valores de premiação (R$) nem enfatiza prêmios. Foco no pódio.
- **Não** exige login para ver o ranking/retrospectiva coletiva — a página é
  pública. Login serve como gancho para a retrospectiva **pessoal**.
- Sem confete e sem bibliotecas pesadas de animação (YAGNI).

## 3. Decisões de design

| ID | Decisão | Justificativa |
|---|---|---|
| Q1 | Landing de encerramento só em `/` para deslogados; logados seguem em `/inicio` | Menor risco, zero impacto no app autenticado. Escolha do usuário sobre "todos, inclusive logados" e "teaser + login". |
| Q2 | Acionada por flag manual de admin `copa_encerrada` (`app_settings`) | Pedido explícito: admin informa manualmente o fim da Copa. Reusa o padrão já existente do convite de evento. |
| Q3 | Foco no pódio; sem premiação em R$ | Escolha do usuário. Evita expor valores em página pública. |
| Q4 | Retrospectiva coletiva "essencial": só dados já calculados | Escolha do usuário. Imersão vem do design, não de novas queries. |
| Q5 | "Dias de bolão" = intervalo da competição (~39 dias) | Zero-query; já é o fallback no código. Escolha do usuário sobre "dias distintos com jogo". |
| Q6 | Home pública lê **flag + ranking + stats via service-role** (`createAdminClient`) | RLS **confirmado** (grep em `supabase/sql/`): `profiles`, `prediction_scores`, `matches` e `app_settings` só têm SELECT `to authenticated`; visitante anônimo não lê **nada**, inclusive a própria flag. Service-role (server-only) é o caminho definitivo; só expõe ranking já público. Escolha do usuário. |
| Q7 | Sem bloco de Patrocínio | Escolha do usuário (cortar o `Sponsors` da landing de encerramento). |
| Q8 | Switch de admin direto, sem diálogo de confirmação | Consistência com o toggle do convite. Escolha do usuário. |
| Q9 | Comemoração "contida e sofisticada": spotlight + shimmer + count-up, sem confete | Escolha do usuário. On-brand ("sangue no olho"), leve e performático. |
| Q10 | Render condicional em `page.tsx` (Abordagem A), seções novas reusando pódio/lista | URL única `/`, sem rota/redirect, reaproveita dados e componentes. Escolhida sobre rota dedicada (B) e troca-só-Hero (C). |

## 4. Arquitetura

### 4.1 A flag `copa_encerrada`

Espelha o par do convite de evento.

- **Chave** `app_settings`: `copa_encerrada` (boolean, default `false`).
- **Server action** `setCopaEncerrada(enabled: boolean)` em
  `src/app/(authenticated)/admin/_actions.ts`, cópia estrutural de
  `setEventInviteEnabled`: valida `user` + `is_admin` (RPC), chama
  `setAppSetting<boolean>("copa_encerrada", enabled)`, e
  `revalidatePath("/")` + `revalidatePath("/admin")`.
- **Card** `CopaEncerradaToggleCard`
  (`src/app/(authenticated)/admin/_components/copa-encerrada-toggle-card.tsx`),
  cópia estrutural de `EventInviteToggleCard` (client, `Switch` + `useTransition`
  + toast). Título "Encerramento da Copa"; label "Exibir landing de retrospectiva".
  Sem diálogo de confirmação (Q8).
- **`admin/page.tsx`**: lê
  `getAppSetting<boolean>("copa_encerrada", false)` e passa `defaultEnabled` ao
  novo card, adicionado no grid junto aos demais.

### 4.2 Render condicional na home (`src/app/page.tsx`)

`Home` já resolve `user` e redireciona logados para `/inicio`. Após esse ponto
(portanto, sempre anônimo), lê a flag e escolhe a landing:

```
user? → redirect("/inicio")            // inalterado
copaEncerrada = getAppSettingAdmin("copa_encerrada", false)   // service-role (Q6)
copaEncerrada
  ├─ true  → <LandingEncerramento />   // + LandingNav/LandingFooter
  └─ false → landing atual (Hero/HowItWorks/Sponsors/Faq/FinalCta)  // inalterada
```

> A leitura da flag na home usa **service-role** (`getAppSettingAdmin`), não o
> `getAppSetting` anônimo — senão o RLS de `app_settings` (só `authenticated`)
> devolveria sempre o fallback `false` e a landing nunca trocaria (Q6). O
> `admin/page.tsx` continua usando `getAppSetting` normal (contexto autenticado).

`errorMessage` (erros de auth via `searchParams`) continua sendo tratado; na
landing de encerramento é repassado ao Hero de coroação para exibição do alerta.

> Nota (`AGENTS.md`): este Next.js tem convenções próprias. Confirmar padrões de
> página `async`/`searchParams` e `next/image` nos docs em
> `node_modules/next/dist/docs/` antes de codar.

### 4.3 Camada de dados

Split puro/IO como no resto do repo (`ranking-core.ts` vs `ranking.ts`), pra o
teste importar só o puro sem esbarrar em `server-only`.

**`src/lib/scoring/collective-core.ts` (novo, puro, sem `server-only`):**

- `pickChampions(rows: RankingRow[]): RankingRow[]` — retorna todos os `rows` com
  `rank === 1` (trata co-campeões). `[]` se vazio. É a função coberta pelos testes
  (§5).

**`src/lib/scoring/collective.ts` (novo, `server-only`, IO):**

- `loadCollectiveStats(): Promise<{ players: number; predictions: number; exacts: number; days: number }>`
  — reusa as contagens que hoje vivem embutidas em `loadRetrospectiva`
  (`retro.ts`, ~linhas 55–71): `profiles` (count), `predictions` (count),
  `prediction_scores` where `tier='exact'` (count). `days` = constante derivada do
  intervalo `COMPETITION.startDate`→`endDate` (Q5).

**Melhoria pontual (DRY):** `loadRetrospectiva` passa a consumir
`loadCollectiveStats()` em vez de repetir as três contagens inline. Mantém o
comportamento atual do `/retrospectiva`.

**Leitura pública via service-role (Q6, confirmado):** como não há SELECT anônimo
em `profiles`/`prediction_scores`/`matches`/`app_settings`, todas as leituras da
home pública passam por `createAdminClient()` (service-role, server-only):

- `loadPublicRanking()` em `ranking.ts`: refatorar o corpo atual de `loadRanking`
  para uma função interna que recebe o client Supabase; `loadRanking()` chama com
  `await createClient()` (mantém `/classificacao` intacto) e `loadPublicRanking()`
  chama com `createAdminClient()`. Zero mudança na agregação.
- `loadCollectiveStats()` usa `createAdminClient()` internamente (contagens globais,
  não sensíveis; serve tanto a home pública quanto o `/retrospectiva`).
- `getAppSettingAdmin<T>(key, fallback)` em `app-settings.ts`: variante de
  `getAppSetting` que usa `createAdminClient()`, para a leitura da flag na home.

Nada além de nome/avatar/pontos (já públicos no ranking) é exposto.

### 4.4 Componente orquestrador (`landing-encerramento.tsx`, novo, server)

`src/app/_components/landing/encerramento/landing-encerramento.tsx`

Server component. Busca dados (`loadPublicRanking()` + `loadCollectiveStats()` em
paralelo — ambos service-role, Q6) e compõe as seções na ordem:

```
① <ChampionHero champions={pickChampions(rows)} errorMessage={…} />
② <RankingPodium rows={rows.slice(0,3)} />                 // reuso
③ <NumbersSection stats={stats} />                          // count-up
④ <RankingList rows={rows.slice(3)} />                      // reuso
⑤ <FinalCtaEncerramento />                                  // login → /retrospectiva
```

Estados de borda (§6) tratados aqui: `rows.length === 0` → estado neutro.

`page.tsx` envolve com `<LandingNav />` … `<LandingFooter />` (reuso), mantendo a
casca da landing atual.

### 4.5 Hero de coroação (`champion-hero.tsx`, novo)

- Mantém `BackgroundDecor` + os **dois logos** (mascote com `animate-float` +
  Coringas), reaproveitando a estrutura visual do `Hero` atual.
- Badge: "Copa 2026 · ENCERRADA · 11 jun → 19 jul".
- Título: "A Copa acabou." + destaque dourado "Temos um campeão." (ou plural para
  co-campeões).
- Revela o(s) campeão(ões): `Avatar` (fallback nas iniciais), nome, `total_points`,
  `exacts_total`, com spotlight radial e shimmer dourado (Q9).
- CTA primário: `GoogleSignInButton` rotulado para "Entrar e ver minha
  retrospectiva". CTA secundário: âncora para a seção de números/ranking.
- Recebe e exibe `errorMessage` (alerta de auth), como o Hero atual.

### 4.6 Números da Copa (`numbers-section.tsx` + `count-up.tsx`, novos — ilhas client)

- `NumbersSection` (server ou client fino) posiciona os cards de stat:
  jogadores · palpites · cravadas · dias de bolão · `COMPETITION.totalMatches` (104).
- `CountUp` (client, `"use client"`): anima a contagem de 0 ao valor quando entra
  na viewport (`IntersectionObserver`), sob `motion-safe`/`prefers-reduced-motion`
  (com reduced-motion, mostra o valor final direto). Animação via
  `requestAnimationFrame`, sem lib externa. Números `tabular` + `font-heading`.

### 4.7 CTA final (`final-cta-encerramento.tsx`, novo)

Adapta o `FinalCta` atual: mensagem "Reviva a SUA Copa" + `GoogleSignInButton`
que leva o visitante a entrar e cair na retrospectiva pessoal (`/retrospectiva`).
Sem menção a inscrição (encerrada).

### 4.8 Dados frescos pós-encerramento (melhoria pontual)

Hoje `recomputeAllScores` e `commitImport` (`admin/_actions.ts`) revalidam
`/inicio`, `/classificacao`, `/palpites`, mas **não** `/`. Adicionar
`revalidatePath("/")` a esses actions para que, com a Copa encerrada, uma correção
tardia de resultado atualize também o ranking público exibido na home.

### 4.9 Sem mudança

- `loadRanking()`, `ranking-core.ts`, `RankingPodium`, `RankingList`,
  `RankingPreview`/`RankingTable`, e toda a landing pré-torneio (renderizada quando
  a flag está desligada).

## 5. Estratégia de testes

Seguindo a convenção do repo (funções puras em Vitest; sem teste de componente).

- **`src/lib/scoring/__tests__/collective-core.test.ts`** (novo) — `pickChampions`:
  - `[]` → `[]`.
  - um único `rank: 1` → esse elemento.
  - dois `rank: 1` (empate) → ambos.
  - nenhum `rank: 1` (defensivo) → `[]`.
- `loadCollectiveStats` fica como casca fina de IO (contagens + constante de dias);
  sem teste dedicado (não mockar Supabase), consistente com o repo.
- Matemática de ranking/desempate **não muda** — coberta por `ranking-core.test.ts`.
- Componentes de coroação/números/CTA são presentacionais — sem teste dedicado.
- Suíte existente mantida verde.

### Verificação manual (no plano)

Em staging, com resultados registrados:
1. Admin liga o switch "Encerramento da Copa" em `/admin`.
2. Visitante **deslogado** em `/` vê a landing de encerramento (coroação → pódio →
   números → classificação → CTA), com os dois logos no Hero.
3. Números animam (count-up) ao rolar; com `prefers-reduced-motion`, aparecem
   estáticos.
4. Usuário **logado** em `/` continua sendo redirecionado para `/inicio`.
5. Admin desliga o switch → `/` volta à landing pré-torneio.
6. Empate no 1º lugar → Hero mostra co-campeões.

## 6. Riscos e questões em aberto

1. **RLS para leitura anônima (resolvido).** Confirmado que não há SELECT anônimo
   em `profiles`/`prediction_scores`/`matches`/`app_settings`; a home pública lê
   flag + ranking + stats via service-role (Q6). Risco residual: garantir que
   `SUPABASE_SERVICE_ROLE_KEY` está disponível no ambiente de produção que
   renderiza `/` (já é usado nos server actions de import, então deve estar).
2. **Empate no 1º lugar.** `assignRanks` dá `rank: 1` a todos os empatados.
   `pickChampions` devolve todos; o Hero exibe co-campeões lado a lado. O pódio
   (`rows.slice(0,3)`) e a lista seguem a mesma lógica honesta já usada em
   `/classificacao`. Caso raro (6 níveis de desempate).
3. **Poucos/nenhum participante.** `rows.length === 0` → estado neutro no
   orquestrador; 1–2 participantes → pódio/lista se adaptam (mesmo comportamento de
   `/classificacao`). Improvável com a Copa encerrada, tratado defensivamente.
4. **Leitura extra na home.** Com a flag ligada, cada visita anônima faz o
   agregado de ranking + 3 contagens. Trivial na escala de um bolão; mesma ordem de
   custo de `/classificacao`. Sem cache (consistente com o repo).
5. **Flag ligada antes de haver campeão.** Se o admin ligar cedo, a página mostra o
   ranking parcial como "final". É responsabilidade operacional do admin (a flag é
   manual por design). Não há trava automática (fora de escopo por Q2).
