"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { GROUP_CODES, type Team } from "@/lib/types/match";
import { upsertTeam } from "../_actions";

export function TeamForm({ team }: { team: Team | null }) {
  return (
    <form action={upsertTeam} className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4 border rounded-md p-4 bg-muted/30">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      <div>
        <Label htmlFor="code">Código FIFA</Label>
        <Input id="code" name="code" defaultValue={team?.code ?? ""} required maxLength={3} />
      </div>
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={team?.name ?? ""} required />
      </div>
      <div>
        <Label htmlFor="flag_url">URL da bandeira</Label>
        <Input id="flag_url" name="flag_url" type="url" defaultValue={team?.flag_url ?? ""} />
      </div>
      <div>
        <Label htmlFor="group_code">Grupo</Label>
        <select
          id="group_code"
          name="group_code"
          defaultValue={team?.group_code ?? ""}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— sem grupo —</option>
          {GROUP_CODES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-4 flex gap-2">
        <Button type="submit">{team ? "Salvar" : "Criar"}</Button>
        <Link href="/admin/times" className={buttonVariants({ variant: "outline" })}>Cancelar</Link>
      </div>
    </form>
  );
}
