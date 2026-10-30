export function TimesheetSkeleton({ manager = false }: { manager?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading timesheets"
      aria-busy="true"
      className="space-y-4"
    >
      <span className="sr-only">Loading timesheets…</span>
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div
        className={
          manager
            ? "hidden overflow-hidden rounded-2xl border border-border md:block"
            : "hidden"
        }
      >
        <div className="h-12 animate-pulse border-b border-border bg-muted" />
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex h-20 items-center gap-4 border-b border-border px-4 last:border-0"
            aria-hidden="true"
          >
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-8 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div
        className={`space-y-3 ${manager ? "md:hidden" : ""}`}
        aria-hidden="true"
      >
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-32 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
