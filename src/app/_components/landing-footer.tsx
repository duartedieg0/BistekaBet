import { Trophy } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Wordmark />
          <p className="max-w-xs text-sm text-muted-foreground">
            O bolão da Copa 2026 que junta a galera, atualiza ao vivo e fecha
            cada rodada sem treta.
          </p>
        </div>

        <FooterCol
          title="Produto"
          links={[
            { label: "Como funciona", href: "#como-funciona" },
            { label: "Pontuação", href: "#" },
            { label: "Criar bolão", href: "#" },
          ]}
        />
        <FooterCol
          title="Recursos"
          links={[
            { label: "Calendário Copa 2026", href: "#" },
            { label: "Regras oficiais", href: "#" },
            { label: "Status", href: "#" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { label: "Termos", href: "#" },
            { label: "Privacidade", href: "#" },
            { label: "Contato", href: "#" },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} BistekaBet. Todos os direitos reservados.</span>
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="size-3.5 text-primary" />
            Bolão da Copa 2026 · feito por torcedores
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground">
        {title}
      </h3>
      <ul className="flex flex-col gap-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Trophy className="size-4" />
      </span>
      <span className="font-heading text-2xl tracking-wide">BistekaBet</span>
    </span>
  );
}
