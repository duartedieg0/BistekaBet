# Retrospectiva Copa 2026 — Design

## Contexto

A Copa do Mundo 2026 termina em **19/07/2026**. Ao longo de ~39 dias e 104 jogos,
os amigos do bolão palpitaram, subiram e caíram no ranking, cravaram placares e
torceram por jogos que jamais imaginaram (Jordânia × Argélia). O propósito do
**BistekaBet** sempre foi esse: um bolão entre amigos para engajar as pessoas no
esporte e na torcida pelo Brasil.

A **Retrospectiva Copa 2026** é o "Wrapped do bolão": uma página pessoal, rolável
e emocional, que reconta a jornada de cada participante — do coletivo ("a gente
viveu isso junto") ao pessoal (sua trajetória) — culmina numa **persona**
divertida atribuída ao usuário, encerra com uma mensagem de torcida pelo Brasil e
o desejo de Hexa na próxima, e desemboca num **card 9:16 compartilhável** para o
Instagram Stories.

Nenhum dado novo é persistido. A retrospectiva é **reconstruída sob demanda** a
partir do que já existe (`prediction_scores`, `predictions`, `profiles`, `matches`),
reaproveitando ao máximo o motor do **Raio-X** (`loadRaioX` / `buildRaioXTimeline`),
que já entrega a trajetória diária, os destaques e os totais do usuário.

## Escopo

- Rota `src/app/(authenticated)/retrospectiva/page.tsx`, **Server Component**,
  sempre do **usuário logado** (sem `[userId]`). Protegida pelo
  `(authenticated)/layout.tsx` existente.
- **Página rolável** com 6 seções narrativas (abertura → coletivo → jornada →
  zebra → persona → despedida) + uma 7ª com o **card compartilhável** e ações.
- **Persona**: cada usuário recebe **exatamente uma** persona, derivada de sinais
  já disponíveis, com **fallback universal** garantido. Cada persona tem título,
  emoji, subtítulo e uma frase de "porquê" ancorada num número real do usuário.
- **Card 9:16 (1080×1920)** para Stories, gerado **client-side** a partir do
  próprio nó DOM do card exibido na tela (WYSIWYG), com **Baixar imagem** e
  **Compartilhar** (Web Share API com arquivo no mobile; download no desktop).
- **Estatísticas coletivas** (contam **todos os inscritos**): amigos no bolão,
  palpites cravados no grupo, placares "na mosca" do grupo, jogos e dias.
- **Acesso**: item **"Retrospectiva"** no menu principal (desktop + mobile),
  **banner** de destaque na home (`/inicio`) para o empurrão do último dia, e um
  link a partir do `/raio-x`.
- Todo usuário logado (**pago ou não**) vê a retrospectiva. Usuários com poucos/sem
  dados recebem uma versão calorosa (coletivo + despedida + persona fallback), sem
  constrangimento.

### Refinamento pré-implementação (passo explícito)

Os **limiares** (thresholds) e a **copy** de cada persona serão **refinados com o
autor antes de codar** — este design fixa o catálogo, os sinais e a mecânica de
atribuição; os números exatos de corte (ex.: "quantas 'na mosca' fazem um
Cravador") e os textos finais são acertados no início do plano de implementação.

### Fora de escopo (YAGNI)

- Formatos de card além do **Stories 9:16** (Feed 1:1/4:5 ficam para depois).
- Geração server-side / OG image (`@vercel/og`) — decidido usar client-side.
- Postagem direta no Instagram (a API web não permite; o fluxo é baixar/compartilhar
  e subir manualmente).
- Retrospectiva de outros jogadores, comparações entre amigos, "quem foi sua
  zebra em comum", etc.
- Persistir persona/retrospectiva no banco, versionar, ou permitir "reescolher"
  persona.
- Animações elaboradas de transição entre seções (scroll simples; micro-transições
  CSS são bem-vindas, mas não são requisito).
- Odds/favoritismo reais para detectar zebra (não existem no sistema — usamos
  heurístico, ver abaixo).

## Arquitetura

### Fluxo de dados (server → client)

```
page.tsx (RSC)
  ├─ getUser() → userId
  ├─ loadRetrospectiva(userId)                [server-only: src/lib/scoring/retro.ts]
  │     ├─ loadRaioX(userId)                  [reuso: timeline + highlights + hasData]
  │     ├─ collective counts (head:true)      [profiles, predictions, exacts do grupo]
  │     ├─ zebra pick (scores + matches + teams do usuário)
  │     ├─ buildRetrospectiva(...)            [core puro: retro-core.ts]
  │     │     ├─ derivePersona(signals)       [catálogo + prioridade + fallback]
  │     │     └─ narrative highlights (jornada, zebra, coletivo)
  │     └─ { user, collective, journey, zebra, persona, hasData }
  │
  ├─ <RetroHero ... />            (server, estático)
  ├─ <RetroCollective ... />      (server, estático)
  ├─ <RetroJourney ... />         (server; mini-gráfico é ilha "use client" recharts)
  ├─ <RetroZebra ... />           (server, estático)
  ├─ <RetroPersonaReveal ... />   (server, estático)
  ├─ <RetroClosing ... />         (server, estático — mensagem Brasil/Hexa + CTA)
  └─ <ShareSection ... />
        ├─ <ShareCard ... />      (o nó 9:16 que vira PNG — markup determinístico)
        └─ <ShareActions ... />   (ILHA "use client" — html-to-image: baixar/compartilhar)
```

O único JS de cliente pesado é (a) a ilha do mini-gráfico (recharts, já no projeto)
e (b) a ilha de ações do card (`html-to-image`). Todo o resto é server-rendered
com dados JSON serializáveis.

### Estrutura de arquivos

**Dependência nova:** instalar **`html-to-image`** (snapshot DOM → PNG). Instalar
**no repo** (nunca `-g`) — passo explícito do plano. A versão exata é validada na
instalação (compatibilidade com React 19 / Next 16 é irrelevante: é lib de runtime
no browser, sem componentes).

```
src/lib/scoring/
  retro-core.ts                  # novo: buildRetrospectiva + derivePersona (PURO)
  retro.ts                       # novo: loadRetrospectiva (server-only, queries)
  __tests__/
    retro-core.test.ts           # novo

src/lib/retro/
  personas.ts                    # novo: catálogo de personas (dados + regras puras)

src/app/(authenticated)/retrospectiva/
  page.tsx                       # novo: RSC, monta a página
  _components/
    retro-hero.tsx               # novo: server
    retro-collective.tsx         # novo: server
    retro-journey.tsx            # novo: server (+ mini-gráfico ilha)
    retro-rank-sparkline.tsx     # novo: ilha "use client" (recharts) — reusa dados
    retro-zebra.tsx              # novo: server
    retro-persona-reveal.tsx     # novo: server
    retro-closing.tsx            # novo: server (mensagem Brasil/Hexa + CTA)
    share-card.tsx               # novo: server — o nó 9:16 fotografado
    share-actions.tsx            # novo: ilha "use client" — html-to-image
    retro-empty.tsx              # novo: fallback dados baixos (raro)

src/app/(authenticated)/_components/
  auth-header.tsx                # editado: novo item "Retrospectiva" no array NAV

src/app/(authenticated)/inicio/_components/
  (novo ou editado)              # banner/CTA "Veja sua Retrospectiva" na home

src/app/(authenticated)/raio-x/_components/
  (editado)                      # link "Veja sua Retrospectiva completa"
```

### Camada de dados — `loadRetrospectiva` (`server-only`)

Reaproveita `loadRaioX(userId)` (timeline, highlights, hasData) e adiciona:

1. **Contagens coletivas** (via count queries, `count: "exact", head: true` — nunca
   puxar linhas, respeitando o teto de 1000 do PostgREST):
   - `profiles` → **amigos no bolão**
   - `predictions` → **palpites cravados (grupo)**
   - `prediction_scores` com `tier = "exact"` → **placares na mosca (grupo)**
   - **jogos** e **dias** vêm de `bolao-config` (104) e da timeline / config (~39).

2. **Seleção da "zebra" do usuário** — busca os `prediction_scores` do usuário com
   join em `matches(home_team, away_team, stage)` (ou reuso do que `loadRaioX` já
   carrega, estendendo o select). Aplica o heurístico de zebra (abaixo) e escolhe
   o **melhor acerto** (maior tier/pontos) num jogo zebra-prone. Pode ser `null`.

Propaga erros com `throw` (padrão do `loadRanking`/`loadRaioX`), deixando o error
boundary do Next tratar.

### Core puro — `buildRetrospectiva` / `derivePersona`

Funções **puras e testáveis** (padrão `*-core.ts`), sem I/O. Entrada = os sinais
já calculados; saída = a retrospectiva montada.

```ts
type PersonaSignals = {
  currentRank: number;
  totalPlayers: number;
  totalPoints: number;
  exactsTotal: number;          // "na mosca"
  exactsKnockout: number;
  winnerOrDrawTotal: number;    // acertos de resultado (tier != miss)
  predictionsScored: number;    // denominador p/ taxa de acerto (O Vidente)
  firstRank: number;            // rank no 1º dia pontuado (p/ O Escalador)
  rankVolatility: number;       // soma |delta| ou amplitude (p/ Montanha-Russa)
  zebraHits: number;            // acertos em jogos zebra-prone
};

type Persona = {
  key: PersonaKey;
  title: string;                // "O Cravador"
  emoji: string;                // "🎯"
  subtitle: string;             // frase curta de identidade
  reason: string;               // "Você cravou 8 na mosca — mais que a galera"
};

function derivePersona(s: PersonaSignals): Persona;   // sempre retorna uma (fallback garantido)
```

**Catálogo de personas** (`src/lib/retro/personas.ts`) — avaliadas em **ordem de
prioridade** (primeira que casar vence), do mais raro/especial ao fallback:

| Ordem | Persona | Emoji | Gatilho (heurístico; limiar refinado antes de codar) | Sinal |
|---|---|---|---|---|
| 1 | Rei/Rainha do Pódio | 👑 | terminou no **top 3** | `currentRank` |
| 2 | O Cravador | 🎯 | muitas "na mosca" (alto `exactsTotal` / top do grupo) | `exactsTotal` |
| 3 | Amante da Zebra | 🦓 | cravou jogos improváveis (`zebraHits` ≥ limiar) | `zebraHits` |
| 4 | O Vidente | 🔮 | alta **taxa de acerto de resultado** (`winnerOrDrawTotal / predictionsScored`) | taxa |
| 5 | O Escalador | 🧗 | posição final **bem melhor** que a inicial (`firstRank − currentRank` ≥ limiar) | timeline |
| 6 | Montanha-Russa | 🎢 | maior **oscilação** de posição (`rankVolatility` ≥ limiar) | deltas |
| 7 | Fiel de Torcida *(fallback)* | 🇧🇷 | esteve presente e torceu junto — sempre casa | participação |

Cada regra é uma função pura `(signals) => boolean`; `derivePersona` percorre o
catálogo em ordem e retorna a primeira que casar, garantindo o fallback na última
posição. A `reason` de cada persona é montada com o número real do usuário
(ex.: `#${rank} de ${totalPlayers}`, `${exactsTotal} na mosca`).

### Heurístico de "zebra" (sem odds no sistema)

O sistema **não tem odds nem favoritismo**. Mantemos uma **lista fixa de seleções
"tradicionais/grandes"** (ex.: Brasil, Argentina, França, Espanha, Inglaterra,
Alemanha, Portugal, Itália, Holanda — lista final revisada no plano) por código de
time. Um jogo é **zebra-prone** quando **nenhum** dos dois times está nessa lista
(ex.: Jordânia × Argélia). A **"sua zebra"** é, entre os jogos zebra-prone que o
usuário acertou, o de **maior tier/pontuação**. Sem acerto zebra-prone →
`zebra = null` e a seção exibe uma frase carinhosa genérica.

Limitação assumida e documentada: é uma aproximação de "jogo improvável", não uma
zebra estatística real. Suficiente para o tom celebrativo da feature.

## UX

### Seções da página (arco emocional)

Todas ocupam largura confortável (`max-w-3xl`/`max-w-4xl`), com bastante respiro
vertical para a sensação de "rolar uma história". Uma seção por bloco:

1. **`RetroHero`** — "Sua Copa 2026 no BistekaBet", nome + avatar (fallback
   iniciais). Frase-tom: *"39 dias. 104 jogos. 1 bolão entre amigos."*
2. **`RetroCollective`** — *"A gente viveu isso junto"*: amigos no bolão · palpites
   do grupo · placares na mosca do grupo · jogos · dias. Números grandes,
   `tabular-nums`. Reforça o propósito.
3. **`RetroJourney`** — sua trajetória: pontos totais · posição final (`#X de N`) ·
   melhor posição (+ dia) · maior subida (`+N` em DD/MM) · na mosca · melhor dia.
   Inclui **`RetroRankSparkline`** (ilha recharts), um mini-gráfico da posição ao
   longo do tempo (eixo Y invertido), reusando a `timeline` do Raio-X.
4. **`RetroZebra`** — *"Sua zebra"*: destaca o jogo improvável cravado
   (bandeiras locais + placar). Se `zebra = null`, frase carinhosa.
5. **`RetroPersonaReveal`** (clímax) — *"Você é:"* + persona grande (emoji +
   título `font-heading uppercase`) + subtítulo + a `reason` com o número real.
6. **`RetroClosing`** — mensagem de gratidão + torcida pelo Brasil + desejo de Hexa
   na próxima. CTA: *"Compartilhe sua Retrospectiva"* → rola/leva ao card.
7. **`ShareSection`** — preview do **`ShareCard`** 9:16 + **`ShareActions`**
   (Baixar imagem / Compartilhar) + aviso honesto sobre o fluxo do Instagram.

### O card compartilhável — `ShareCard` (9:16, 1080×1920)

Markup **determinístico** (nada que dependa de fonte/emoji não carregado no momento
do snapshot). Conteúdo:

- **Topo:** wordmark **BistekaBet** + "Retrospectiva Copa 2026".
- **Você:** avatar (inline data-URL; fallback iniciais) + nome.
- **Herói:** a **persona** em destaque (emoji + título grande) + subtítulo.
- **Números-chave** (grid 2×2): Posição final `#X/N` · Pontos · Na mosca · Maior
  subida *(ou "sua zebra")*.
- **Tagline de propósito:** *"39 dias torcendo junto pelo Brasil 🇧🇷"*.
- **Rodapé:** *"bistekabet · bolão entre amigos · #RumoAoHexa"* + URL do app.
- **Visual:** fundo em gradiente nas cores da marca, `font-heading`, `tabular-nums`.

### Mecânica de compartilhamento — `ShareActions` (ilha `"use client"`)

- **Baixar imagem** → `html-to-image` (`toPng`) sobre o nó do `ShareCard`, com
  `pixelRatio` calculado para atingir **1080×1920** a partir do tamanho renderizado
  → dispara download do PNG (`a.download`).
- **Compartilhar** → se `navigator.canShare({ files: [pngFile] })`, usa
  `navigator.share` (abre a folha de compartilhamento do sistema — IG, WhatsApp
  etc.); senão, cai no download.
- **Preparação anti-CORS** antes do snapshot: **bandeiras via SVG local** (nada de
  URL externa no card), e **avatar inlinado** como data-URL (`fetch` → `FileReader`)
  no server ou antes do render; se falhar, usa iniciais. Fontes web precisam estar
  carregadas antes do primeiro snapshot (garantir via `document.fonts.ready`).
- **Aviso honesto** na UI: a web não posta direto no Stories; o fluxo é
  baixar/compartilhar e subir manualmente no Instagram.
- Estados de UI: idle → "gerando…" (durante o `toPng`) → sucesso/erro (via `sonner`,
  já no projeto).

### Navegação e entradas

- `auth-header.tsx`: adicionar `{ href: "/retrospectiva", label: "Retrospectiva" }`
  ao array `NAV` (cobre menu desktop e mobile de uma vez).
- **Home (`/inicio`)**: banner/CTA de destaque *"Sua Copa acabou — veja sua
  Retrospectiva"* para o empurrão do último dia.
- **Raio-X**: link *"Veja sua Retrospectiva completa"*.

## Casos de borda / segurança emocional

- **Poucos/sem dados** (`hasData=false`, mesma regra do Raio-X: `totalPoints > 0`):
  esconde jornada/zebra/persona competitiva; mostra **coletivo + despedida +
  persona "Fiel de Torcida"** e um card ainda bonito. Sem constrangimento.
- **Último colocado:** nunca dizer "último"; enquadrar por participação, melhores
  momentos e persona positiva. **Nenhuma persona é negativa.**
- **Avatar ausente:** iniciais do `display_name`.
- **Zebra ausente:** frase carinhosa ("você torceu por jogos que nunca imaginou").
- **Empates de persona:** a ordem de prioridade do catálogo desempata de forma
  **determinística** (primeira regra que casar vence).
- **`html-to-image` falha** (browser antigo / erro de render): mostra toast de erro
  e mantém o card visível para screenshot manual como último recurso.
- **`navigator.share` indisponível** (desktop / navegador sem suporte): botão
  Compartilhar cai para download, sem quebrar.
- **Bucketização de dia:** herdada do Raio-X (fuso fixo `America/Sao_Paulo`).

## Acessibilidade

- Cada seção com hierarquia de headings correta; números com label textual
  associado; ícones/emoji decorativos com `aria-hidden` quando redundantes.
- Mini-gráfico com `aria-label` descritivo; os mesmos dados aparecem em texto na
  seção da jornada (alternativa textual).
- Botões Baixar/Compartilhar com `aria-label` claros e estado de "gerando" anunciado.
- Valores numéricos com `tabular-nums`; contraste do card validado nas cores da marca.

## Testes

`retro-core.test.ts` (vitest, em `src/lib/scoring/__tests__/`, seguindo a cultura
do diretório):

- **Atribuição de persona:** cada persona dispara com input forjado que satisfaz só
  o gatilho dela; verifica-se o `key` retornado.
- **Prioridade determinística:** input que satisfaz **duas** regras retorna a de
  **maior prioridade** (a primeira do catálogo).
- **Fallback garantido:** input "vazio"/mínimo retorna **Fiel de Torcida**.
- **`reason` ancorada em número real:** a frase contém o valor correto do sinal
  (ex.: `exactsTotal`).
- **Heurístico de zebra:** jogo com dois times fora da lista de "grandes" é
  zebra-prone; jogo com um grande não é; escolha do melhor acerto entre zebras;
  `zebra = null` quando não há acerto zebra-prone.
- **Coletivo:** montagem dos números coletivos a partir das contagens (com a função
  pura recebendo os counts já resolvidos).
- **`hasData=false`** encaminha para a versão fallback (persona Fiel de Torcida,
  sem seções competitivas).

A ilha do `html-to-image`, a ilha do recharts e as queries `server-only` **não**
entram em teste unitário (dependem de browser/Supabase); o valor de teste está no
core puro (`retro-core` + `personas`).

## Decisões e trade-offs

- **Reuso do Raio-X:** `loadRaioX`/`buildRaioXTimeline` já entregam timeline,
  highlights e totais consistentes com a Classificação oficial. A retrospectiva os
  reempacota numa narrativa em vez de recalcular — fonte única de verdade.
- **Client-side `html-to-image` (vs `@vercel/og`):** WYSIWYG e reuso total do
  design system (gradientes, grid, fontes já carregadas) valem mais, para um card
  emocional e bespoke, que a consistência do Satori (que exige reescrever o card num
  CSS limitado). Custo: cuidar de CORS (bandeiras locais + avatar inline) e garantir
  fontes carregadas antes do snapshot.
- **Persona por prioridade + fallback:** simples, determinístico e testável; garante
  que **todo mundo** recebe um título positivo. Trade-off: um usuário que casaria em
  várias personas recebe só a de maior prioridade (aceito — evita ambiguidade e
  mantém o "rótulo" único e forte).
- **Zebra por heurístico (lista fixa de grandes):** sem odds no sistema, é a melhor
  aproximação barata de "jogo improvável"; assumida como celebrativa, não estatística.
- **Coletivo via count queries:** respeita o teto de 1000 linhas do PostgREST e é
  barato (sem materializar linhas).
- **Stories 9:16 primeiro:** é o formato onde esse tipo de "wrapped" mais circula;
  Feed fica para uma 2ª etapa se houver demanda.
- **Refino de personas antes de codar:** o catálogo/mecânica estão fixados aqui, mas
  limiares e copy são sensíveis ao "feeling" e serão calibrados com o autor no
  arranque do plano, evitando retrabalho de tuning depois de implementado.
