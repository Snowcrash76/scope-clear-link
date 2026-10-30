import { AuditTrail as TeamAuditTrail } from "@/components/team/AuditTrail";

import type { TeamBootstrap } from "../../../shared/employeePortal";

export function AuditTrail({ rows }: { rows: TeamBootstrap["audit"] }) {
  return <TeamAuditTrail rows={rows} />;
}
