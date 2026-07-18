import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";

export function RetroHero({
  user,
}: {
  user: { displayName: string; avatarDataUrl: string | null };
}) {
  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Retrospectiva · Copa 2026
      </p>

      {user.avatarDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarDataUrl}
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover ring-2 ring-primary/30"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-24 w-24 items-center justify-center rounded-full bg-muted font-heading text-3xl uppercase text-muted-foreground ring-2 ring-primary/20"
        >
          {getInitials(user.displayName)}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Sua Copa 2026 no BistekaBet
        </h1>
        <p className="text-lg font-medium text-primary">{user.displayName}</p>
        <p className="text-muted-foreground">
          39 dias. 104 jogos. 1 bolão entre amigos.
        </p>
      </div>
    </section>
  );
}
