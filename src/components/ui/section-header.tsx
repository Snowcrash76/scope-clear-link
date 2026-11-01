import type { ReactNode } from "react";

export function SectionHeader({
  title,
  count,
  action,
  className = "",
}: {
  title: string;
  count?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate font-heading text-lg font-semibold leading-6 text-foreground">{title}</h2>
        {count != null && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>}
      </div>
      {action}
    </div>
  );
}
