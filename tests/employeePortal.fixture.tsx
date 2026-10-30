import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../src/hooks/useAuth';
import { EmployeeHome, EmployeeTimesheets, EmployeeJob } from '../src/components/EmployeePortalUI';
import { TeamHome } from '../src/components/TeamPortalUI';

// Component-only harness for browser layout/interaction checks. It is not routed
// by App.tsx or shipped to production. The browser test intercepts /api with
// isolated response fixtures; the production auth provider and API client remain unchanged.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'today';

function Fixture() {
  const initialPath = view === 'job' ? '/employee/jobs/fixture-job' : view === 'team' ? '/team' : view === 'team-timesheets' ? '/team/timesheets' : view === 'assignments' ? '/team/assignments' : view === 'timesheets' ? '/employee/timesheets' : '/employee';
  return <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/employee" element={<EmployeeHome />} />
          <Route path="/employee/timesheets" element={<EmployeeTimesheets />} />
          <Route path="/employee/jobs/:jobId" element={<EmployeeJob />} />
          <Route path="/team" element={<TeamHome />} />
          <Route path="/team/timesheets" element={<TeamHome />} />
          <Route path="/team/assignments" element={<TeamHome />} />
          <Route path="/team/jobs/:id/:panel" element={<TeamHome />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  </QueryClientProvider>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
