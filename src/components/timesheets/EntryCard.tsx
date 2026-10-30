import type { ReactNode } from "react";
export function EntryCard({ children }: { children: ReactNode }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-soft">
      {children}
    </article>
  );
}
