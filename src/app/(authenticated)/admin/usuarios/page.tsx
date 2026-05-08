// Lista de usuários do bolão. Mescla auth.users (email, last_sign_in_at)
// com profiles (display_name, avatar_url) via service-role server-side.
import { createAdminClient } from "@/lib/supabase/admin";
import { PaidToggle } from "./_components/paid-toggle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  paid: boolean;
};

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  paid: boolean;
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

async function loadUsers(): Promise<UserRow[]> {
  const supabase = createAdminClient();

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at, paid");
  if (profErr) throw profErr;

  const profileById = new Map<string, ProfileRow>(
    (profiles as ProfileRow[]).map((p) => [p.id, p]),
  );

  return list.users
    .map<UserRow>((u) => {
      const p = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "—",
        displayName: p?.display_name ?? u.email?.split("@")[0] ?? "—",
        avatarUrl: p?.avatar_url ?? null,
        createdAt: p?.created_at ?? u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        paid: p?.paid ?? false,
      };
    })
    .sort((a, b) => {
      const ta = a.lastSignInAt ? Date.parse(a.lastSignInAt) : 0;
      const tb = b.lastSignInAt ? Date.parse(b.lastSignInAt) : 0;
      return tb - ta;
    });
}

export default async function UsuariosPage() {
  const users = await loadUsers();

  return (
    <>
      <header className="flex flex-col gap-1 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
          Usuários
        </p>
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Participantes do bolão
        </h1>
        <p className="text-muted-foreground">
          {users.length} {users.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}
          {users.length > 0 ? ` · ${users.filter((u) => u.paid).length} pagaram` : ""}.
        </p>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead>Cadastro</TableHead>
            <TableHead>Último acesso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum usuário cadastrado ainda.
              </TableCell>
            </TableRow>
          ) : (
            users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Avatar size="sm">
                    {u.avatarUrl ? (
                      <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                    ) : null}
                    <AvatarFallback>{initials(u.displayName)}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{u.displayName}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <PaidToggle userId={u.id} paid={u.paid} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {dateFmt.format(new Date(u.createdAt))}
                </TableCell>
                <TableCell className="tabular-nums">
                  {u.lastSignInAt ? dateFmt.format(new Date(u.lastSignInAt)) : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
