import type { TeamBootstrap } from "../../../shared/employeePortal";

const card =
  "rounded-2xl border border-border bg-card shadow-[0_3px_14px_rgba(33,54,43,.045)]";
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

export function AuditTrail({ rows }: { rows: TeamBootstrap["audit"] }) {
  return (
    <section className={`${card} mt-5 p-5`}>
      <h2 className="font-bold">Immutable review audit</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Recorded decisions and changes, newest first.
      </p>
      {rows.length ? (
        <ol className="mt-4 space-y-3">
          {[...rows].reverse().map((row) => (
            <li key={row.id} className="flex gap-3 border-t border-border pt-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-success" />
              <span className="min-w-0 flex-1">
                <b className="text-sm">{row.action.replace(/_/g, " ")}</b>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {formatDate(row.created_at)} · actor{" "}
                  {row.actor_id.slice(0, 8)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No review activity recorded yet.
        </p>
      )}
    </section>
  );
}
