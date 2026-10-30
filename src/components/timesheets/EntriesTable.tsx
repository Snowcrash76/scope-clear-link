import type { ReactNode } from "react";
export function EntriesTable({
  children,
  label = "Timesheet entries",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table
        className="w-full min-w-[700px] border-collapse text-left text-sm"
        aria-label={label}
      >
        {children}
      </table>
    </div>
  );
}
