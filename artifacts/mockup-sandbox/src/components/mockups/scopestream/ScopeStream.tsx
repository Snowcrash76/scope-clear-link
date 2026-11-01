import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "./_shared/ScopeStream.css";
import { AppShell } from "./_shared/components";
import ComingSoon from "./_shared/ComingSoon";
import Dashboard from "./_shared/Dashboard";
import JobDetails from "./_shared/JobDetails";
import Jobs from "./_shared/Jobs";
import { ScopeProvider } from "./_shared/ScopeContext";

function ScrollReset() {
  const location = useLocation();
  useEffect(() => {
    const scroller = document.querySelector(".ss-main");
    if (scroller && !location.hash) scroller.scrollTop = 0;
  }, [location.pathname, location.hash]);
  return null;
}

function ScopeRoutes() {
  return <ScopeProvider>
    <AppShell>
      <ScrollReset />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/schedule" element={<ComingSoon />} />
        <Route path="/financials" element={<ComingSoon financial />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </AppShell>
  </ScopeProvider>;
}

export function ScopeStream() {
  return <div className="ss-root"><MemoryRouter initialEntries={["/"]}><ScopeRoutes /></MemoryRouter></div>;
}
