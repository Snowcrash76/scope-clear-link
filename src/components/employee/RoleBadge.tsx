import { Badge } from "@/components/ui/badge";
import type { EmployeeRole } from "../../../shared/employeePortal";
import { roleLabels } from "../../../shared/employeePortal";

export function RoleBadge({ role }: { role: EmployeeRole }) {
  return <Badge variant="secondary" className="shrink-0">{roleLabels[role]}</Badge>;
}
