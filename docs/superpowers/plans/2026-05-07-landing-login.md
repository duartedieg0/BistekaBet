# Landing Page & Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a landing page pública (`/`) e o fluxo de autenticação Google OAuth via Supabase, com `profiles` (role usuario/admin), proteção de rotas híbrida (`proxy.ts` + layouts) e header autenticado com logout.

**Architecture:** Next.js 16 App Router com Route Groups `(authenticated)` para escopo logado e `(authenticated)/admin` para escopo admin. `proxy.ts` (renomeado de middleware no Next 16) renova sessão Supabase e bloqueia rotas protegidas no nível do cookie; layouts fazem verificação fina (existência de profile, role). Schema `profiles` com trigger `on auth.users insert` cria registro automaticamente; trigger `before update` impede mudança de `role` pelo cliente. Smoke test manual ao final.

**Tech Stack:** Next.js 16.2.5 · React 19 · TypeScript · `@supabase/ssr` · Tailwind v4 · shadcn/ui · `@base-ui/react` · `lucide-react`

**Spec de referência:** `docs/superpowers/specs/2026-05-07-landing-login-design.md`

---

## Notas importantes

- **Convenção Next 16:** `middleware.ts` foi renomeado para `proxy.ts`. O arquivo `src/proxy.ts` já existe e exporta `proxy()`. Veja `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **Sem framework de testes nesse PR.** A spec definiu smoke test manual. As tarefas usam **verificações manuais** no lugar de TDD. Setup de Vitest/Playwright fica para spec separada.
- **SQL aplicado manualmente no Supabase Studio.** O arquivo `supabase/sql/001_init_profiles.sql` é mantido no repo como referência versionada — não é executado por CLI.
- **Idioma de UI:** Português (pt-BR). Strings de rota e código permanecem em inglês onde já estavam.

---

## Mapa de arquivos

**Criar:**
- `supabase/sql/001_init_profiles.sql` — referência versionada do schema/trigger/RLS
- `src/types/profile.ts` — tipo `Profile` compartilhado
- `src/app/auth/callback/route.ts` — GET handler do OAuth callback
- `src/app/auth/signout/route.ts` — POST handler de logout
- `src/app/_components/google-sign-in-button.tsx` — Client Component
- `src/app/(authenticated)/layout.tsx` — guard + AuthHeader wrapper
- `src/app/(authenticated)/_components/auth-header.tsx` — header com avatar/dropdown
- `src/app/(authenticated)/_components/avatar-fallback.tsx` — iniciais a partir de display_name (helper)
- `src/app/(authenticated)/inicio/page.tsx` — placeholder
- `src/app/(authenticated)/admin/layout.tsx` — guard de role
- `src/app/(authenticated)/admin/page.tsx` — placeholder
- `src/components/ui/dropdown-menu.tsx` — shadcn add (CLI)
- `src/components/ui/avatar.tsx` — shadcn add (CLI)

**Modificar:**
- `src/lib/supabase/middleware.ts` — `updateSession` passa a retornar `{ response, user }`
- `src/proxy.ts` — adicionar bloqueio de rotas PROTECTED
- `src/app/page.tsx` — substituir template por landing real
- `src/app/layout.tsx` — atualizar `metadata` (title/description) e `lang`

---

## Task 0: Aplicação manual do SQL (gate)

**Files:**
- Create: `supabase/sql/001_init_profiles.sql`

- [ ] **Step 1: Criar `supabase/sql/001_init_profiles.sql`**

```sql
-- BistekaBet — schema inicial do auth/profiles
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

-- Tabela
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'usuario' check (role in ('usuario','admin')),
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Trigger de criação automática
create or replace function public.handle_new_user() returns trigger
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

-- Helper para evitar recursão de RLS
create or replace function public.is_admin(uid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;

-- Trigger que impede mudança de role via UPDATE direto do cliente
create or replace function public.prevent_role_change() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role can only be changed via service role';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- RLS
alter table public.profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_admin_read_all" on profiles
  for select using (public.is_admin(auth.uid()));
```

- [ ] **Step 2: Aplicar SQL no Supabase Studio**

Abrir Supabase Studio → SQL Editor → colar o conteúdo de `supabase/sql/001_init_profiles.sql` → Run.

- [ ] **Step 3: Verificar criação da tabela e policies**

No SQL Editor:

```sql
select table_name from information_schema.tables where table_schema='public' and table_name='profiles';
select policyname from pg_policies where tablename='profiles';
select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass;
```

Expected: tabela `profiles` listada; 3 policies (`profiles_select_own`, `profiles_update_own`, `profiles_admin_read_all`); trigger `profiles_prevent_role_change`. Trigger `on_auth_user_created` está em `auth.users`:

```sql
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and tgname='on_auth_user_created';
```

- [ ] **Step 4: Configurar Google OAuth no Supabase**

1. Google Cloud Console → criar OAuth 2.0 Client → Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase Studio → Authentication → Providers → Google → Enable + colar Client ID/Secret.
3. Supabase Studio → Authentication → URL Configuration → Site URL: `http://localhost:3000`. Adicionar `http://localhost:3000/auth/callback` em "Redirect URLs".

- [ ] **Step 5: Commit**

```bash
git add supabase/sql/001_init_profiles.sql
git commit -m "feat(db): add profiles schema, trigger and RLS reference SQL"
```

---

## Task 1: Tipo `Profile` compartilhado

**Files:**
- Create: `src/types/profile.ts`

- [ ] **Step 1: Criar tipo**

```ts
// src/types/profile.ts
export type Role = "usuario" | "admin";

export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/profile.ts
git commit -m "feat(types): add Profile type"
```

---

## Task 2: Refatorar `updateSession` para retornar `user`

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Substituir conteúdo de `src/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sem erros (ou apenas erros pré-existentes não relacionados).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "refactor(auth): updateSession returns response and user"
```

---

## Task 3: Atualizar `proxy.ts` com bloqueio de rotas

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Substituir `src/proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PATHS = [/^\/inicio(\/|$)/, /^\/admin(\/|$)/];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (PROTECTED_PATHS.some((re) => re.test(pathname)) && !user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Verificação manual rápida**

Run: `npm run dev`
Acessar `http://localhost:3000/inicio` deslogado → deve redirecionar para `/`.
(`/inicio` ainda não existe nesse momento — o redirect acontece antes do 404, então o teste é válido. Se aparecer 404, o proxy não está bloqueando.)

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(proxy): block protected paths for unauthenticated users"
```

---

## Task 4: Adicionar shadcn `avatar` e `dropdown-menu`

**Files:**
- Create: `src/components/ui/avatar.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`

- [ ] **Step 1: Adicionar componentes via CLI**

Run:
```bash
npx shadcn@latest add avatar dropdown-menu
```

Expected: arquivos criados em `src/components/ui/`. CLI pode pedir confirmação — aceitar.

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/avatar.tsx src/components/ui/dropdown-menu.tsx package.json package-lock.json
git commit -m "feat(ui): add shadcn avatar and dropdown-menu"
```

---

## Task 5: `GoogleSignInButton` (Client Component)

**Files:**
- Create: `src/app/_components/google-sign-in-button.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [supabase] = useState(() => createClient());

  async function handleClick() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/inicio`,
      },
    });
  }

  return (
    <Button size="lg" onClick={handleClick}>
      <GoogleIcon />
      Entrar com Google
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12S6.8 21.4 12 21.4c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/google-sign-in-button.tsx
git commit -m "feat(auth): add GoogleSignInButton client component"
```

---

## Task 6: `/auth/callback` route handler

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Criar handler**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/inicio";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(auth): add OAuth callback handler"
```

---

## Task 7: `/auth/signout` route handler

**Files:**
- Create: `src/app/auth/signout/route.ts`

- [ ] **Step 1: Criar handler**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/signout/route.ts
git commit -m "feat(auth): add signout handler"
```

---

## Task 8: Landing `/` (substituir template)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Atualizar metadata e lang em `src/app/layout.tsx`**

Preserve o `import type { Metadata } from "next"` existente. Trocar `lang="en"` por `lang="pt-BR"` e substituir o objeto `metadata`:

```ts
export const metadata: Metadata = {
  title: "BistekaBet — Bolão da Copa 2026",
  description: "Palpite, dispute e suba no ranking do bolão da Copa 2026.",
};
```

- [ ] **Step 2: Substituir `src/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "./_components/google-sign-in-button";
import { createClient } from "@/lib/supabase/server";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Não foi possível concluir o login. Tente novamente.",
  profile: "Sua conta foi criada, mas o perfil não pôde ser carregado. Tente entrar novamente.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/inicio");

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          BistekaBet
        </p>
        <h1 className="max-w-xl text-4xl font-bold tracking-tight md:text-6xl">
          Bolão da Copa 2026
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Palpite, dispute e suba no ranking.
        </p>
      </div>

      <GoogleSignInButton />

      {errorMessage && (
        <p className="max-w-sm text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verificar TypeScript e dev server**

Run: `npx tsc --noEmit` (sem erros).
Run: `npm run dev` (se não estiver rodando) e abrir `http://localhost:3000` — deve renderizar a landing nova. `?error=auth` mostra mensagem.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat(landing): replace template with hero + Google sign-in"
```

---

## Task 9: `(authenticated)/layout.tsx` + AuthHeader

**Files:**
- Create: `src/app/(authenticated)/_components/avatar-fallback.tsx`
- Create: `src/app/(authenticated)/_components/auth-header.tsx`
- Create: `src/app/(authenticated)/layout.tsx`

- [ ] **Step 1: Criar helper de iniciais**

```tsx
// src/app/(authenticated)/_components/avatar-fallback.tsx
export function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
```

- [ ] **Step 2: Criar `AuthHeader` (Client Component)**

> Por que Client: o `<form>` precisa ficar fora do `DropdownMenuContent` (portaled) para evitar DOM inválido (`role=menu` envolvendo `<form>`). Solução: form escondido fora do menu + `onSelect` no item dispara `requestSubmit()`.

```tsx
// src/app/(authenticated)/_components/auth-header.tsx
"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/types/profile";
import { getInitials } from "./avatar-fallback";

export function AuthHeader({ profile }: { profile: Profile }) {
  const signoutFormRef = useRef<HTMLFormElement>(null);

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <Link href="/inicio" className="font-semibold tracking-tight">
        BistekaBet
      </Link>

      {/* form fora do menu para evitar DOM inválido (form dentro de role=menu) */}
      <form
        ref={signoutFormRef}
        action="/auth/signout"
        method="post"
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="size-9">
            <AvatarImage
              src={profile.avatar_url ?? undefined}
              alt={profile.display_name}
            />
            <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="font-medium">{profile.display_name}</span>
            {profile.role === "admin" && (
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Admin
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              signoutFormRef.current?.requestSubmit();
            }}
            className="flex items-center gap-2"
          >
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 3: Criar layout autenticado**

```tsx
// src/app/(authenticated)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import { AuthHeader } from "./_components/auth-header";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/?error=profile");

  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader profile={profile} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authenticated\)/
git commit -m "feat(auth): add authenticated layout with header"
```

---

## Task 10: `/inicio` placeholder

**Files:**
- Create: `src/app/(authenticated)/inicio/page.tsx`

- [ ] **Step 1: Criar página**

```tsx
export default function InicioPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-3xl font-bold">Início</h1>
      <p className="text-muted-foreground">Em construção.</p>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(authenticated\)/inicio/
git commit -m "feat(inicio): add placeholder home page"
```

---

## Task 11: `/admin` com guard de role

**Files:**
- Create: `src/app/(authenticated)/admin/layout.tsx`
- Create: `src/app/(authenticated)/admin/page.tsx`

- [ ] **Step 1: Criar layout admin**

```tsx
// src/app/(authenticated)/admin/layout.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // user já garantido pelo (authenticated)/layout pai; defensivo apenas
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: "usuario" | "admin" }>();

  if (profile?.role !== "admin") notFound();

  return <>{children}</>;
}
```

> Nota: o `(authenticated)/layout.tsx` pai já garante `user` + `profile`. O fetch aqui é redundante mas evita acoplar layouts via context. É uma query barata em PK; aceitável até ter mais lógica admin para justificar context.

- [ ] **Step 2: Criar página admin**

```tsx
// src/app/(authenticated)/admin/page.tsx
export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-3xl font-bold">Admin</h1>
      <p className="text-muted-foreground">Em construção.</p>
    </main>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/admin/
git commit -m "feat(admin): add admin route with role guard"
```

---

## Task 12: Smoke test manual end-to-end

**Files:** —

Pré-requisito: `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` válidos. Google OAuth configurado (Task 0 step 4).

- [ ] **Step 1: Iniciar dev server**

Run: `npm run dev`
Abrir `http://localhost:3000`.

- [ ] **Step 2: Login feliz**

Clicar "Entrar com Google" → autenticar → cair em `/inicio`. Verificar header com avatar e nome do Google.

- [ ] **Step 3: Profile criado no banco**

No Supabase Studio SQL Editor:
```sql
select id, role, display_name, avatar_url from public.profiles order by created_at desc limit 1;
```
Expected: linha com `role='usuario'`, `display_name` e `avatar_url` preenchidos a partir do Google.

- [ ] **Step 4: Auto-redirect logado**

Acessar `http://localhost:3000/` (já logado) → redireciona automaticamente para `/inicio`.

- [ ] **Step 5: Bloqueio deslogado**

Logout via dropdown ("Sair") → cai em `/`. Tentar `http://localhost:3000/inicio` → cai em `/`.

- [ ] **Step 6: `/admin` proibido para usuário comum**

Login novamente. Tentar `http://localhost:3000/admin` → 404.

- [ ] **Step 7: Promover a admin via SQL**

No Supabase Studio (service role):
```sql
update public.profiles set role = 'admin' where id = '<seu-uuid>';
```

- [ ] **Step 8: `/admin` permitido para admin**

Acessar `http://localhost:3000/admin` (sem relogar) → renderiza placeholder. Abrir o dropdown → badge "Admin" visível.

- [ ] **Step 9: RLS bloqueia update de role pelo cliente**

Pelo browser, no console (estando logado):
```js
const { createClient } = await import('/_next/...'); // ou usar a instância da app
// alternativamente, no Studio com role=anon e JWT do user:
```
Mais simples: no Studio SQL Editor, mudar o role do executor para `authenticated` com o JWT do user e tentar:
```sql
update public.profiles set role = 'admin' where id = auth.uid();
```
Expected: erro "role can only be changed via service role".

(Se essa verificação for chata de fazer, registrar como pendente; o trigger garante o comportamento.)

- [ ] **Step 10: Erro de auth visível**

Logout. Iniciar login Google e cancelar consentimento → redirect para `/?error=auth` com mensagem de erro visível.

- [ ] **Step 11: Commit final (se houve ajustes durante smoke)**

```bash
git add -A
git status
# se houve mudanças:
git commit -m "fix: smoke test adjustments"
```

---

## Critérios de aceitação

- [ ] Landing renderiza hero + botão Google em uma tela.
- [ ] Login Google cria profile (`role='usuario'`) automaticamente.
- [ ] Pós-login redireciona para `/inicio`.
- [ ] Visitante já autenticado em `/` é mandado para `/inicio`.
- [ ] Não-logado em `/inicio` ou `/admin/*` cai em `/`.
- [ ] `usuario` em `/admin/*` recebe 404.
- [ ] Admin (após promoção SQL) acessa `/admin` e vê badge no header.
- [ ] Logout via header limpa sessão e volta para `/`.
- [ ] Tentativa de `update role` pelo cliente falha (trigger).
- [ ] `?error=auth` e `?error=profile` exibem mensagens inline na landing.
- [ ] `npx tsc --noEmit` sem erros novos.
