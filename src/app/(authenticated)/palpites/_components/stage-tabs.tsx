"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GROUP_CODES, STAGE_LABELS, STAGES, type Stage } from "@/lib/types/match";

export function StageTabs({ current, groupCode }: { current: Stage; groupCode?: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3 mb-6">
      <Tabs
        value={current}
        onValueChange={(v) => {
          const stage = v as Stage;
          const href = stage === "group" ? "/palpites?stage=group&group=A" : `/palpites?stage=${stage}`;
          router.push(href);
        }}
      >
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="max-w-none">
            {STAGES.map((s) => (
              <TabsTrigger key={s} value={s} className="flex-none shrink-0">
                {STAGE_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {current === "group" ? (
        <div className="flex flex-wrap gap-1.5">
          {GROUP_CODES.map((g) => {
            const active = groupCode === g;
            return (
              <Link
                key={g}
                href={`/palpites?stage=group&group=${g}`}
                aria-current={active ? "page" : undefined}
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "h-7 px-2.5 cursor-pointer font-mono",
                    !active && "hover:bg-muted",
                  )}
                >
                  {g}
                </Badge>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
