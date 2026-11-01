import { BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, LayoutDashboard } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const tabs = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/projects", label: "Jobs", Icon: BriefcaseBusiness },
  { to: "/schedule", label: "Schedule", Icon: CalendarDays },
  { to: "/profitability", label: "Profitability", Icon: ChartNoAxesCombined },
];

export function BottomTabBar() {
  const { pathname } = useLocation();
  const isJobDetail = pathname.startsWith("/manage/") || pathname.startsWith("/jobs/");
  return (
    <nav
      aria-label="Primary navigation"
      data-testid="bottom-tab-bar"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(23,48,78,.08)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-4">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-current={to === "/projects" && isJobDetail ? "page" : undefined}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition-colors ${
                isActive || (to === "/projects" && isJobDetail) ? "text-primary" : "text-muted-foreground"
              }`
            }
            aria-label={label}
          >
            <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
            <span className="max-w-full truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
