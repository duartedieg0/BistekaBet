export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex flex-col gap-4 pb-6">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </main>
  );
}
