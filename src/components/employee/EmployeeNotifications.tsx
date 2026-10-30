import {
  usePortal,
  useRefreshPortal,
  portalRequest,
} from "@/hooks/useEmployeePortal";

import { toast } from "sonner";

import type {
  EmployeeBootstrap,
  PortalNotification,
} from "../../../shared/employeePortal";

import { card, fmtDate, getError } from "./portalShared";
import { LoadState } from "./LoadState";
import { PortalLayout } from "./PortalLayout";
import { PageTitle } from "./PageTitleView";
import { Empty } from "./Empty";

export function EmployeeNotifications() {
  const q = usePortal<EmployeeBootstrap>("/employee/bootstrap");
  const refresh = useRefreshPortal();
  async function mark(n: PortalNotification) {
    if (n.read_at) return;
    try {
      await portalRequest(`/employee/notifications/${n.id}/read`, {});
      await refresh();
    } catch (err) {
      toast.error(getError(err));
    }
  }
  return (
    <PortalLayout>
      <PageTitle
        eyebrow="Field portal / updates"
        title="Notifications"
        description="Schedule changes, timesheet reviews and job updates."
      />
      <div>
        {q.isLoading ? (
          <LoadState retry={() => q.refetch()} />
        ) : q.error ? (
          <LoadState error={q.error} retry={() => q.refetch()} />
        ) : q.data?.notifications.length ? (
          <div className="space-y-3">
            {q.data.notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => mark(n)}
                className={`${card} flex min-h-20 w-full items-start gap-4 p-4 text-left ${n.read_at ? "opacity-70" : ""}`}
              >
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-muted" : "bg-muted"}`}
                />
                <span className="min-w-0 flex-1">
                  <b className="block">{n.title}</b>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {n.body}
                  </span>
                  <small className="mt-2 block text-muted-foreground">
                    {fmtDate(n.created_at)}
                  </small>
                </span>
                {!n.read_at && (
                  <span className="self-center text-xs font-semibold text-muted-foreground">
                    Mark read
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="All caught up"
            detail="New schedule updates and timesheet decisions will show here."
          />
        )}
      </div>
    </PortalLayout>
  );
}
