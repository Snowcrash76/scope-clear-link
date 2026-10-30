import { Navigate } from "react-router-dom";

import { usePortalSession } from "@/hooks/useEmployeePortal";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

import { shell, outline } from "./portalShared";

export function EmployeeGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const portal = usePortalSession(!!user);
  if (loading || (user && portal.isLoading))
    return (
      <div className={`${shell} min-h-[100dvh] p-6`}>
        <div className="mx-auto max-w-4xl space-y-3 pt-12">
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  if (!user) return <Navigate to="/employee/login" replace />;
  if (portal.error)
    return (
      <div className={`${shell} min-h-[100dvh] p-6`}>
        <div className="mx-auto mt-12 max-w-lg rounded-2xl border p-6">
          <h1 className="text-xl font-bold">Portal setup needed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {portal.error.message}
          </p>
          <p className="mt-3 text-sm">
            Apply{" "}
            <code>supabase/migrations/20261029000000_employee_portal.sql</code>{" "}
            then retry.
          </p>
          <Button
            className={`${outline} mt-4`}
            onClick={() => portal.refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  if (!portal.data?.employee)
    return (
      <Navigate
        to={portal.data?.canManageTeam ? "/team" : "/employee/login"}
        replace
      />
    );
  return <>{children}</>;
}
