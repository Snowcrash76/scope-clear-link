import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, LogOut, Menu, X } from "lucide-react";
import { usePortalSession } from "@/hooks/useEmployeePortal";
import { useAuth } from "@/hooks/useAuth";

import { roleLabels } from "../../../shared/employeePortal";
import { shell, outline } from "./portalShared";
import { UnreadDot } from "./UnreadDot";

export function PortalLayout({
  children,
  management = false,
  embedded = false,
}: {
  children: React.ReactNode;
  management?: boolean;
  embedded?: boolean;
}) {
  const { employee, canManageTeam } = usePortalSession().data ?? {};
  const { signOut } = useAuth();
  const location = useLocation().pathname;
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const mainAppHref = employee ? "/employee" : "/dashboard";
  const active = (href: string) =>
    location === href || (href !== "/employee" && location.startsWith(href));
  const items = management
    ? [
        ["/team", "Team"],
        ["/team/assignments", "Assignments"],
        ["/team/timesheets", "Timesheets"],
        ["/team/permissions", "Permissions"],
      ]
    : [
        ["/employee", "Today"],
        ["/employee/week", "This week"],
        ["/employee/timesheets", "Timesheets"],
        ["/employee/notifications", "Updates"],
      ];
  if (embedded) return <div className="portal-shell">{children}</div>;
  return (
    <div className={shell}>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to={management ? "/team" : "/employee"}
            className="flex min-h-11 items-center gap-3"
            aria-label="ScopeClear home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-white">
              <span className="portal-mono text-xs">SC</span>
            </span>
            <span>
              <b className="block text-[15px] tracking-tight">ScopeClear</b>
              <small className="block text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                {management ? "Team desk" : "Field portal"}
              </small>
            </span>
          </Link>
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            {items.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className={`min-h-11 rounded-xl px-3.5 py-3 text-sm font-medium ${active(to) ? "bg-muted text-muted-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {!management && (
              <Link
                to="/employee/notifications"
                className={`${outline} relative !w-11 !px-0`}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <UnreadDot />
              </Link>
            )}
            {management && !canManageTeam && null}
            <button
              className={`${outline} !w-11 !px-0 md:hidden`}
              aria-label="Open navigation"
              onClick={() => setMenu((v) => !v)}
            >
              {menu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <button
              className={`${outline} hidden sm:inline-flex`}
              onClick={async () => {
                await signOut();
                navigate("/employee/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
        {management && canManageTeam && (
          <div className="border-t border-border">
            <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
              <Link
                to={mainAppHref}
                className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Back to main app</span>
              </Link>
            </div>
          </div>
        )}
        {menu && (
          <nav className="grid grid-cols-2 gap-2 border-t border-border p-3 md:hidden">
            {items.map(([to, label]) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenu(false)}
                className={`${outline} justify-start`}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
        {!management && employee && (
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-semibold">{employee.name}</p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {roleLabels[employee.role]}
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
