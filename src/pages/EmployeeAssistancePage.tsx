import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePortalSession } from '@/hooks/useEmployeePortal';
import { useEmployeeAssistance } from '@/hooks/useEmployeeAssistance';
import { isEmployeeMemberId } from '@/lib/employeeAssistance';
import { Button } from '@/components/ui/button';
import { EmployeeAssistanceBanner } from '@/components/employee/EmployeeAssistanceBanner';
import { EmployeeHome } from '@/components/employee/EmployeeHome';
import { EmployeeJob } from '@/components/employee/EmployeeJob';
import { EmployeeTimesheets } from '@/components/employee/EmployeeTimesheets';
import { EmployeeNotifications } from '@/components/employee/EmployeeNotifications';
import Schedule from '@/components/schedule/Schedule';

function AccessState({ title, children }: { title: string; children?: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 bg-background p-5">
    <h1 className="text-xl font-semibold">{title}</h1>{children}
    <Link className="min-h-11 py-3 font-medium text-primary underline" to="/team">Back to Team</Link>
  </main>;
}

function AssistanceMember() {
  const { user, loading } = useAuth();
  const { memberId, href } = useEmployeeAssistance();
  const validMember = isEmployeeMemberId(memberId);
  const session = usePortalSession(Boolean(user) && validMember && !loading);
  if (loading) return <AccessState title="Checking your account…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!validMember) return <AccessState title="Team member unavailable"><p>Open the employee portal from a member’s card on Team.</p></AccessState>;
  if (session.isLoading) return <AccessState title="Checking employee portal access…" />;
  if (session.error) return <AccessState title="Unable to open employee portal">
    <p role="alert">{session.error.message}</p>
    <Button variant="outline" onClick={() => session.refetch()}>Retry access check</Button>
  </AccessState>;
  const context = session.data?.assistance;
  if (!context || context.ownerId !== user.id || context.memberId !== memberId || context.readOnly !== true) {
    return <AccessState title="Employee portal preview unavailable"><p>Only the business owner can open this preview. Return to Team and choose a member.</p></AccessState>;
  }
  if (context.status !== 'active') {
    const status = {
      setup_required: ['Account setup incomplete', 'This member has not linked an employee account yet. Use Account setup to send or resend their invitation.'],
      inactive: ['Employee access is inactive', 'This member cannot currently sign in to the portal. Use Help edit details to review their access.'],
      removed: ['Team member removed', 'Their work history has been retained, but their employee portal is unavailable.'],
    }[context.status];
    return <div className="min-h-screen bg-background"><EmployeeAssistanceBanner />
      <main className="mx-auto max-w-2xl space-y-3 p-5"><h1 className="text-xl font-semibold">{status[0]}</h1><p>{status[1]}</p>
        <p className="text-sm text-muted-foreground">You remain signed in as yourself. No employee password is needed.</p>
      </main>
    </div>;
  }
  return <Routes>
    <Route index element={<EmployeeHome />} />
    <Route path="week" element={<EmployeeHome week />} />
    <Route path="jobs/:jobId" element={<EmployeeJob />} />
    <Route path="timesheets" element={<EmployeeTimesheets />} />
    <Route path="notifications" element={<EmployeeNotifications />} />
    <Route path="schedule" element={<Schedule />} />
    <Route path="*" element={<AccessState title="Preview page not found"><Link to={href('/employee')}>Back to employee home</Link></AccessState>} />
  </Routes>;
}

export default function EmployeeAssistancePage() {
  const { user } = useAuth();
  const { memberId } = useEmployeeAssistance();
  // Discard component state when either the real account or selected member changes.
  return <AssistanceMember key={`${user?.id ?? 'anonymous'}:${memberId}`} />;
}
