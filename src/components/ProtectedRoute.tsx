import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePortalSession } from '@/hooks/useEmployeePortal';

interface ProtectedRouteProps {
  children: React.ReactNode;
  teamOnly?: boolean;
}

export function ProtectedRoute({ children, teamOnly = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const portal = usePortalSession(!!user);

  if (loading || (user && portal.isLoading)) {
    return (
      <div className="min-h-[100dvh] bg-white p-6">
        <div className="mx-auto max-w-4xl space-y-4 pt-12" aria-label="Loading access">
          <div className="h-12 animate-pulse rounded-xl bg-[#edf1ed]" />
          <div className="h-32 animate-pulse rounded-2xl bg-[#edf1ed]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (portal.error) {
    return <div className="min-h-[100dvh] bg-white p-6"><div role="alert" className="mx-auto mt-16 max-w-lg rounded-2xl border border-[#e5e9e5] p-6"><h1 className="text-xl font-bold">Unable to verify access</h1><p className="mt-2 text-sm text-[#68766c]">{portal.error.message}</p>{/migration|relation|schema|setup/i.test(portal.error.message)&&<p className="mt-3 rounded-xl bg-[#fff7e8] p-3 text-sm">Employee portal setup is required. Apply <code>supabase/migrations/20261029000000_employee_portal.sql</code> then retry.</p>}<button className="mt-4 min-h-11 rounded-xl border px-4" onClick={() => portal.refetch()}>Retry</button></div></div>;
  }
  const session = portal.data;
  if (teamOnly && !session?.canManageTeam) {
    return <Navigate to={session?.employee ? '/employee' : '/dashboard'} replace />;
  }
  if (!teamOnly && session?.employee) {
    return <Navigate to={session.canManageTeam ? '/team' : '/employee'} replace />;
  }

  return <>{children}</>;
}
