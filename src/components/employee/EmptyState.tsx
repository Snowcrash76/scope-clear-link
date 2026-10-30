import { CalendarDays } from "lucide-react";

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="portal-grid rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/20 text-accent-foreground">
        <CalendarDays className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}
