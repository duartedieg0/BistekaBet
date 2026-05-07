"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { GROUP_CODES, STAGE_LABELS, STAGES, type Stage } from "@/lib/types/match";

export function StageTabs({ current, groupCode }: { current: Stage; groupCode?: string }) {
  return (
    <div className="space-y-3 mb-6">
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => {
          const href = s === "group" ? "/admin/partidas?stage=group&group=A" : `/admin/partidas?stage=${s}`;
          const active = current === s;
          return (
            <Link
              key={s}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm border",
                active ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              )}
            >
              {STAGE_LABELS[s]}
            </Link>
          );
        })}
      </div>
      {current === "group" ? (
        <div className="flex flex-wrap gap-1">
          {GROUP_CODES.map((g) => {
            const active = groupCode === g;
            return (
              <Link
                key={g}
                href={`/admin/partidas?stage=group&group=${g}`}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-mono border",
                  active ? "bg-foreground text-background" : "bg-background hover:bg-muted"
                )}
              >
                {g}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
