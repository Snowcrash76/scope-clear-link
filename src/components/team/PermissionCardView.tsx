import { PermissionCard as TeamPermissionCard } from "@/components/team/PermissionCard";

import type {
  EmployeeRole,
  OperationalPermissions,
} from "../../../shared/employeePortal";

export function PermissionCard({
  role,
  initial,
  save,
}: {
  role: EmployeeRole;
  initial: OperationalPermissions;
  save: (r: EmployeeRole, p: OperationalPermissions) => void;
}) {
  return <TeamPermissionCard role={role} initial={initial} save={save} />;
}
