import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import type { Persona } from "@/lib/retro/personas";
import type { RetroJourney, ZebraCandidate } from "@/lib/scoring/retro-core";

// Marca fixa: este card NUNCA usa tokens de tema/oklch/dark-mode.
// html-to-image pode falhar com oklch()/custom-properties, então usamos
// apenas hex hard-coded (Tailwind arbitrary values / inline style).
const RED = "#D23A2B";
const RED_DEEP = "#A82415";
const GOLD = "#F2B33D";
const INK = "#211A17";
const CREAM = "#FBF8F3";

export type ShareCardProps = {
  persona: Persona;
  journey: RetroJourney;
  zebra: ZebraCandidate | null;
  user: { displayName: string; avatarDataUrl: string | null };
};

function Stat({
  label,
  value,
  hero = false,
}: {
  label: string;
  value: string;
  hero?: boolean;
}) {
  return (
    <div
      className="flex flex-col justify-center rounded-2xl px-5 py-4"
      style={{
        background: "rgba(251, 248, 243, 0.06)",
        border: "1px solid rgba(242, 179, 61, 0.28)",
        boxShadow: "inset 0 1px 0 0 rgba(251, 248, 243, 0.08)",
      }}
    >
      <span
        className="text-[15px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "rgba(251, 248, 243, 0.62)" }}
      >
        {label}
      </span>
      <span
        className={`tabular-nums font-heading leading-none ${
          hero ? "mt-2 text-[34px]" : "mt-1 text-[46px]"
        }`}
        style={{ color: hero ? GOLD : CREAM, letterSpacing: "0.01em" }}
      >
        {value}
      </span>
    </div>
  );
}

export function ShareCard({ persona, journey, zebra, user }: ShareCardProps) {
  const fourth = zebra
    ? { label: "Sua zebra", value: `${zebra.homeName} × ${zebra.awayName}`, hero: true }
    : { label: "Maior subida", value: `+${journey.biggestClimb}`, hero: false };

  return (
    <div
      id="retro-share-card"
      className="relative flex h-[960px] w-[540px] flex-col overflow-hidden"
      style={{
        color: CREAM,
        fontFeatureSettings: '"tnum"',
        background: `linear-gradient(160deg, ${INK} 0%, ${RED_DEEP} 52%, ${RED} 100%)`,
      }}
    >
      {/* Estampa / raios de trofeu ao fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, rgba(242,179,61,0.30) 0%, rgba(242,179,61,0.0) 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full"
        style={{ background: "rgba(242,179,61,0.14)", filter: "blur(8px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-[440px] w-[440px] rounded-full"
        style={{ background: "rgba(33,26,23,0.45)", filter: "blur(4px)" }}
      />
      {/* Barra dourada superior */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-2"
        style={{ background: GOLD }}
      />

      <div className="relative flex h-full flex-col px-12 pb-11 pt-14">
        {/* 1. Header / wordmark */}
        <header className="flex items-center justify-between">
          <span className="font-heading text-[30px] uppercase leading-none tracking-tight">
            Bisteka<span style={{ color: GOLD }}>Bet</span>
          </span>
          <span
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: "rgba(251,248,243,0.7)" }}
          >
            Retrô
          </span>
        </header>
        <span
          className="mt-2 text-[13px] font-semibold uppercase tracking-[0.32em]"
          style={{ color: GOLD }}
        >
          Retrospectiva Copa 2026
        </span>

        {/* 2. Usuario */}
        <div className="mt-8 flex items-center gap-4">
          {user.avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarDataUrl}
              alt=""
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-full object-cover"
              style={{ border: `3px solid ${GOLD}` }}
            />
          ) : (
            <div
              aria-hidden
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full font-heading text-[26px] uppercase"
              style={{
                background: "rgba(251,248,243,0.10)",
                border: `3px solid ${GOLD}`,
                color: CREAM,
              }}
            >
              {getInitials(user.displayName)}
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span
              className="text-[13px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "rgba(251,248,243,0.62)" }}
            >
              A retrô de
            </span>
            <span className="truncate text-[26px] font-bold leading-tight">
              {user.displayName}
            </span>
          </div>
        </div>

        {/* 3. Persona hero (a estrela) */}
        <div className="mt-9 flex flex-1 flex-col items-center justify-center text-center">
          <span aria-hidden className="text-[112px] leading-none drop-shadow-lg">
            {persona.emoji}
          </span>
          <span
            className="mt-1 text-[14px] font-bold uppercase tracking-[0.28em]"
            style={{ color: GOLD }}
          >
            Você foi
          </span>
          <h1
            className="mt-2 font-heading text-[68px] uppercase leading-[0.92]"
            style={{ color: CREAM, textShadow: "0 3px 0 rgba(33,26,23,0.35)" }}
          >
            {persona.title}
          </h1>
          <p
            className="mt-4 max-w-[380px] text-[19px] font-medium leading-snug"
            style={{ color: "rgba(251,248,243,0.85)" }}
          >
            {persona.subtitle}
          </p>
        </div>

        {/* 4. Stats grid 2x2 */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat
            label="Posição final"
            value={`#${journey.currentRank}/${journey.totalPlayers}`}
          />
          <Stat label="Pontos" value={`${journey.totalPoints}`} />
          <Stat label="Na mosca" value={`${journey.exactsTotal}`} />
          <Stat label={fourth.label} value={fourth.value} hero={fourth.hero} />
        </div>

        {/* 5. Tagline */}
        <p className="mt-8 text-center text-[18px] font-semibold leading-snug">
          39 dias torcendo junto pelo Brasil{" "}
          <span aria-hidden>🇧🇷</span>
        </p>

        {/* 6. Footer */}
        <footer className="mt-6 flex items-center justify-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: GOLD }}
          />
          <span
            className="text-[13px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "rgba(251,248,243,0.72)" }}
          >
            bistekabet · bolão entre amigos ·{" "}
            <span style={{ color: GOLD }}>#RumoAoHexa</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
