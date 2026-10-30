import { usePortal } from "@/hooks/useEmployeePortal";

import type { EmployeeBootstrap } from "../../../shared/employeePortal";

export function UnreadDot() {
  const { data } = usePortal<EmployeeBootstrap>("/employee/bootstrap");
  const count = data?.notifications.filter((n) => !n.read_at).length ?? 0;
  return count > 0 ? (
    <span
      aria-label={`${count} unread`}
      className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-info px-1 text-xs font-bold text-info-foreground ring-2 ring-background"
    >
      {count > 9 ? "9+" : count}
    </span>
  ) : null;
}
