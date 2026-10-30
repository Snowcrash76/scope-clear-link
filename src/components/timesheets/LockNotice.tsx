import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
export function LockNotice({
  children = "This week is locked. Reopen the whole week before correcting or deleting entries.",
}: {
  children?: ReactNode;
}) {
  return (
    <div
      role="note"
      className="flex gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm leading-5 text-foreground"
    >
      <LockKeyhole
        className="mt-0.5 h-4 w-4 shrink-0 text-warning"
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}
