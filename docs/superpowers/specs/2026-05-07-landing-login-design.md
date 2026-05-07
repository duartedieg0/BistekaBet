# Landing Page & Login (Google OAuth via Supabase) — Design

**Data:** 2026-05-07
**Projeto:** BistekaBet (BB) — bolão da Copa do Mundo 2026
**Stack:** Next.js 16.2.5 (App Router) · React 19 · Supabase (`@supabase/ssr`) · Tailwind v4 · shadcn/ui · `@base-ui/react`

---

## 1. Objetivo

Entregar a landing page pública e o fluxo de autenticação do BistekaBet:

- Landing pública com hero + CTA "Entrar com Google".
- Login exclusivamente via Google OAuth, integrado com Supabase Auth.
- Sem fluxo de registro: a primeira autenticação cria o profile automaticamente.
- Após login, redirecionar para `/inicio` (página construída em PR posterior — placeholder neste escopo).
- Dois perfis: `usuario` (padrão) e `admin` (promovido manualmente via SQL).
- Header global mínimo nas rotas autenticadas com avatar + "Sair".

## 2. Escopo

**Inclui:**
- Landing `/` (hero único, sem scroll).
- OAuth callback handler.
- Logout (rota `/auth/signout`).
- Schema `public.profiles` + trigger de criação + RLS.
- Route Groups `(authenticated)` e `(authenticated)/admin` com proteção fina.
- Atualização do `proxy.ts` com bloqueio raso por cookie.
- Header autenticado (`AuthHeader`) com avatar + dropdown + logout.
- Placeholders para `/inicio` e `/admin`.

**Não inclui:**
- Conteúdo real da página `/inicio` (palpites, ranking).
- Conteúdo real do painel admin.
- Edição de apelido pelo usuário (item futuro do dropdown).
- Setup de framework de testes (smoke test manual neste PR).
- Adição da Supabase CLI ao projeto (SQL será aplicado manualmente no Studio).

## 3. Decisões de design

| # | Decisão | Escolha |
|---|---|---|
| 1 | Tipo de landing | Hero único (sem "como funciona", sem footer) |
| 2 | Definição de admin | Coluna `role` em `profiles`, promoção manual via SQL |
| 3 | Redirect pós-login | Sempre `/inicio`; `/admin/*` restrito por role |
| 4 | Schema `profiles` | `id`, `role`, `display_name` (editável), `avatar_url`, timestamps |
| 5 | Criação do profile | Trigger SQL no Supabase (`on auth.users insert`) |
| 6 | Conteúdo landing | Só hero — uma tela, sem scroll |
| 7 | Logout/Header | Header global no layout autenticado já neste PR |
| 8 | Proteção de rotas | Híbrido: `proxy.ts` (cookie) + layouts (role/profile) |
| 9 | Migrações | Aplicar SQL manualmente no Supabase Studio |
| 10 | Testes | Smoke test manual documentado |

## 4. Arquitetura & rotas

### 4.1 Estrutura de arquivos

```
src/
  proxy.ts                                  // Next 16 (renomeado de middleware)
  app/
    layout.tsx                              // root, sem auth
    page.tsx                                // landing pública (Server Component)
    _components/
      google-sign-in-button.tsx             // Client Component
    auth/
      callback/route.ts                     // GET — exchange code → session
      signout/route.ts                      // POST — signOut + redirect /
    (authenticated)/
      layout.tsx                            // garante user + profile + AuthHeader
      _components/
        auth-header.tsx                     // header com avatar/dropdown
      inicio/
        page.tsx                            // placeholder
      admin/
        layout.tsx                          // role='admin' ou notFound()
        page.tsx                            // placeholder
  lib/
    supabase/
      client.ts                             // já existe
      server.ts                             // já existe
      middleware.ts                         // já existe (renovação de sessão)
```

### 4.2 Fluxo end-to-end

1. Visitante acessa `/`.
2. `page.tsx` checa sessão; se logado, `redirect('/inicio')`.
3. Senão renderiza hero + `<GoogleSignInButton />`.
4. Click → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback?next=/inicio' } })`.
5. Google → `/auth/callback?code=...&next=/inicio`.
6. Handler chama `exchangeCodeForSession(code)`. Sucesso → redirect `next`. Falha → redirect `/?error=auth`.
7. `proxy.ts` renova sessão em todas as rotas e redireciona não-logados que tentem `/inicio` ou `/admin/*` para `/`.
8. `(authenticated)/layout.tsx` confirma `getUser()` e carrega `profile` do banco; ausência → `redirect('/?error=profile')`.
9. `(authenticated)/admin/layout.tsx` verifica `profile.role === 'admin'`; senão `notFound()`.
10. Logout: `<form action="/auth/signout" method="post">` → `signOut()` → redirect `/`.

## 5. Banco de dados (Supabase)

### 5.1 Schema

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'usuario' check (role in ('usuario','admin')),
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

### 5.2 Trigger de criação automática

```sql
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 5.3 RLS

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from profiles where id = auth.uid())
  );

create policy "profiles_admin_read_all" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
```

> **Promoção a admin:** manual via SQL Studio:
> `update public.profiles set role = 'admin' where id = '<uuid>';`

### 5.4 Aplicação

SQL aplicado manualmente no Supabase Studio (sem CLI neste momento). O bloco completo será mantido no spec como referência.

## 6. Proteção de rotas

### 6.1 `proxy.ts` (cookie-level)

Mantém a chamada existente a `updateSession` e adiciona bloqueio raso para rotas protegidas quando não há `user`:

```ts
const PROTECTED = [/^\/inicio(\/|$)/, /^\/admin(\/|$)/];
if (PROTECTED.some(r => r.test(pathname)) && !user) {
  return NextResponse.redirect(new URL('/', request.url));
}
```

### 6.2 Layout autenticado (`(authenticated)/layout.tsx`)

```ts
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect('/');

const { data: profile } = await supabase
  .from('profiles')
  .select('id, role, display_name, avatar_url')
  .eq('id', user.id)
  .single();

if (!profile) redirect('/?error=profile');
```

Profile passado por prop ao `AuthHeader` e disponível para descendentes via render direto (sem context global por enquanto).

### 6.3 Layout admin (`(authenticated)/admin/layout.tsx`)

Re-busca profile (ou recebe via prop pattern do parent) e:

```ts
if (profile.role !== 'admin') notFound();
```

`notFound()` retorna 404, não vaza existência da rota.

## 7. UI

### 7.1 Landing (`/`)

- Server Component.
- Layout: flex column, `min-h-screen`, centrado vertical/horizontal.
- Conteúdo:
  - Logo BistekaBet (placeholder textual ou SVG simples por enquanto).
  - Título: "Bolão da Copa 2026" (`text-4xl md:text-6xl font-bold`).
  - Subtítulo: "Palpite, dispute e suba no ranking." (`text-lg text-muted-foreground`).
  - `<GoogleSignInButton />` (Client) — shadcn `Button` size `lg` + ícone Google.
  - Mensagem de erro inline se `searchParams.error === 'auth'` ou `'profile'`.
- Auto-redirect: se `getUser()` retorna user, `redirect('/inicio')`.

### 7.2 `AuthHeader`

- Renderizado em todo `(authenticated)/*`.
- Esquerda: logo BistekaBet (link para `/inicio`).
- Direita: dropdown (base-ui ou shadcn `dropdown-menu`):
  - Trigger: avatar (com fallback de iniciais derivadas de `display_name`).
  - Conteúdo: `display_name`, badge "Admin" se aplicável, divider, "Sair" (form POST para `/auth/signout`).

### 7.3 Placeholders

- `/inicio`: `<h1>Início</h1><p>Em construção.</p>`
- `/admin`: `<h1>Admin</h1><p>Em construção.</p>`

## 8. Tratamento de erros

| Cenário | Onde | Comportamento |
|---|---|---|
| OAuth cancelado / `code` ausente ou inválido | `/auth/callback` | `redirect('/?error=auth')` |
| Trigger não criou profile (anomalia) | `(authenticated)/layout` | `redirect('/?error=profile')` |
| Sessão expirada em rota protegida | `proxy.ts` | `redirect('/')` |
| Usuário comum acessa `/admin/*` | `(admin)/layout` | `notFound()` (404) |
| Falha de rede ao consultar Supabase | layouts/route handlers | Error Boundary do Next; log no `console.error` |

A landing exibe a mensagem inline correspondente ao `error` lido de `searchParams`.

## 9. Variáveis de ambiente

Já assumidas pelo projeto (em `.env.local`, não comitado):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Configuração externa (fora do código): habilitar Google provider em Supabase Studio → Authentication → Providers → Google, com `redirect URLs` apontando para `<origin>/auth/callback`.

## 10. Smoke test manual

A executar antes de considerar o PR pronto:

1. **Login feliz:** acessar `/` deslogado → clicar "Entrar com Google" → autenticar → cair em `/inicio`. Verificar header com avatar.
2. **Profile criado:** consultar `select * from profiles where id='<uuid>'` no Studio → linha existe com `role='usuario'`, `display_name` e `avatar_url` preenchidos.
3. **Auto-redirect logado:** acessar `/` já logado → ir direto para `/inicio` sem ver landing.
4. **Bloqueio deslogado:** logout, tentar `/inicio` → cai em `/`.
5. **Admin proibido:** sendo `usuario`, tentar `/admin` → 404.
6. **Admin permitido:** promover via SQL `update profiles set role='admin' where id=...`, recarregar → acessar `/admin` → renderiza placeholder. Header mostra badge "Admin".
7. **Logout:** clicar "Sair" no dropdown → cai em `/`, sessão limpa, tentar `/inicio` → cai em `/`.
8. **Erro de auth:** simular cancelar consentimento Google → cai em `/?error=auth` com mensagem visível.

## 11. Riscos & considerações

- **Trigger silencioso:** se `handle_new_user` falhar, o usuário fica autenticado sem profile. Mitigação: `(authenticated)/layout` redireciona para `/?error=profile`. Considerar log/alerta posterior.
- **`role` via cliente:** RLS impede update do `role` por cliente. Verificar policy em smoke test (tentar `update profiles set role='admin' where id=auth.uid()` no SQL → deve falhar).
- **Edge runtime no proxy:** não importar bibliotecas pesadas no `proxy.ts`. Manter apenas `@supabase/ssr` no helper de middleware.
- **Race condition de profile:** o `(authenticated)/layout` pode rodar antes da trigger comitar em casos extremos? Trigger é síncrona com o insert em `auth.users`, então o `exchangeCodeForSession` retorna depois da trigger. Não esperado, mas o redirect com `?error=profile` cobre.

## 12. Itens fora deste PR (próximos passos)

- Conteúdo real de `/inicio` (palpites, jogos).
- Painel admin com listagem de usuários, promoção via UI.
- Edição de `display_name` pelo usuário.
- Adoção da Supabase CLI + migrações versionadas.
- Setup de Vitest/Playwright.
