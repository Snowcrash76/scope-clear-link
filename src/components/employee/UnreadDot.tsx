import { usePortal } from "@/hooks/useEmployeePortal";

import type { EmployeeBootstrap } from "../../../shared/employeePortal";

export function UnreadDot() {
  const { data } = usePortal<EmployeeBootstrap>("/employee/bootstrap");
  const count = data?.notifications.filter((n) => !n.read_at).length ?? 0;
  return count > 0 ? (
    <span
      aria-label={`${count} unread`}
      className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-muted px-1 text-[9px] font-bold text-white ring-2 ring-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  ) : null;
}
