import { Link } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { usePortalSession } from "@/hooks/useEmployeePortal";
import { useEmployeeAssistance } from "@/hooks/useEmployeeAssistance";

export function EmployeeAssistanceBanner() {
  const session = usePortalSession().data;
  const assistance = useEmployeeAssistance();
  const context = session?.assistance;
  if (!assistance.active || !assistance.memberId || !context) return null;
  const id = context.memberId;
  const name = session?.employee?.name ?? (context.status === "removed" ? "Removed team member" : "Employee");
  const removed = context.status === "removed";
  const stateLabel = context.status === "setup_required" ? "Setup required" : context.status === "inactive" ? "Inactive" : removed ? "Removed" : "Read-only";
  return (
    <aside className="mb-5 rounded-xl border border-warning/40 bg-warning/10 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4" aria-label="Employee assistance status">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background text-warning"><Eye className="h-4 w-4" /></span>
        <div>
          <p className="font-semibold">{removed ? "Employee portal unavailable" : `Helping ${name}`} <span className="ml-1 rounded-full border border-warning/40 px-2 py-0.5 text-xs font-semibold">{stateLabel}</span></p>
          <p className="mt-0.5 text-sm text-muted-foreground">{removed ? "This member has been removed. Their work history remains with the business." : context.status === "setup_required" ? "Account setup is incomplete. Invitation actions happen as the owner." : context.status === "inactive" ? "This employee account is inactive. Review access as the owner." : "You’re viewing their employee portal. Changes must be made as the owner."}</p>
          {!removed && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {context.status === "active" && <Link className="font-semibold underline underline-offset-2" to={`/team?assist=${encodeURIComponent(id)}&edit=${encodeURIComponent(id)}`}>Help edit details</Link>}
            {context.status === "active" && <Link className="font-semibold underline underline-offset-2" to={`/team/timesheets?assist=${encodeURIComponent(id)}&employee=${encodeURIComponent(id)}`}>Help edit timesheets</Link>}
            {(context.status === "setup_required" || context.status === "active") && <Link className="font-semibold underline underline-offset-2" to={`/team?assist=${encodeURIComponent(id)}&account=${encodeURIComponent(id)}`}>Account setup</Link>}
            {context.status === "inactive" && <Link className="font-semibold underline underline-offset-2" to={`/team?assist=${encodeURIComponent(id)}&edit=${encodeURIComponent(id)}`}>Help edit details</Link>}
          </div>}
        </div>
      </div>
      <Link className="mt-3 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold sm:mt-0" to="/team"><ArrowLeft className="h-4 w-4" />Back to Team</Link>
    </aside>
  );
}
