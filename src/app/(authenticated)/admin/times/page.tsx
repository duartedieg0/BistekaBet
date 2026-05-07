import { AdminShell } from "@/app/(authenticated)/admin/_components/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { TeamForm } from "./_components/team-form";
import type { Team } from "@/lib/types/match";

export default async function TimesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .order("group_code", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;

  const editing = sp.edit ? teams?.find((t) => t.id === sp.edit) : null;
  const showForm = Boolean(sp.new) || Boolean(editing);

  return (
    <AdminShell active="/admin/times" breadcrumbs={[{ label: "Times" }]}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl">Times</h1>
        <Link href="/admin/times?new=1" className={buttonVariants()}>Nova seleção</Link>
      </div>

      {showForm ? <TeamForm team={editing ?? null} /> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead className="w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(teams as Team[] | null)?.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-mono">{t.code}</TableCell>
              <TableCell>{t.name}</TableCell>
              <TableCell>{t.group_code ?? "—"}</TableCell>
              <TableCell>
                <Link href={`/admin/times?edit=${t.id}`} className="text-sm underline">
                  Editar
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminShell>
  );
}
