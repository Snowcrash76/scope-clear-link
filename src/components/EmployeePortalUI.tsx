import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  LogOut,
  MapPin,
  Menu,
  X,
} from "lucide-react";
import {
  usePortal,
  usePortalSession,
  useRefreshPortal,
  portalRequest,
  uploadEmployeePhoto,
} from "@/hooks/useEmployeePortal";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { TimesheetSummary } from "@/components/TimesheetSummary";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageTitle as EmployeePageTitle } from "@/components/employee/PageTitle";
import { EmptyState } from "@/components/employee/EmptyState";
import { PhotoGallery as EmployeePhotoGallery } from "@/components/employee/PhotoGallery";
import type {
  EmployeeBootstrap,
  EmployeeJobDetail,
  PortalAssignment,
  PortalJob,
  PortalNotification,
  PortalReviews,
  PortalSubmission,
  PortalTimeEntry,
  PortalDocument,
} from "../../shared/employeePortal";
import {
  localDate,
  localDateTimeToUtc,
  paidMinutes,
  weekStart,
  roleLabels,
  permissionNames,
} from "../../shared/employeePortal";

const shell = "portal-shell";
const card =
  "rounded-2xl border border-[#e5e9e5] bg-white shadow-[0_3px_14px_rgba(33,54,43,.045)]";
const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50";
const primary = `${btn} bg-success text-success-foreground hover:bg-success/90`;
const outline = `${btn} border border-input bg-background text-foreground hover:bg-accent/20`;
const field =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
const today = () => localDate(new Date(), "Australia/Sydney");
const fmtDate = (s?: string) =>
  s
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(`${s.slice(0, 10)}T12:00:00`))
    : "";
const fmtTime = (s?: string | null, timezone = "Australia/Sydney") =>
  s
    ? new Intl.DateTimeFormat("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(s))
    : "";
const datetimeForZone = (value: string, zone: string) => {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
};
const mins = (n: number) =>
  `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, "0")}m`;
const elapsed = (from: string, to: number) => {
  const seconds = Math.max(0, Math.floor((to - Date.parse(from)) / 1000));
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
};
const getError = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
async function openCapabilityUrl(path: string) {
  const viewer = window.open("about:blank", "_blank");
  if (viewer) viewer.opener = null;
  try {
    if (!viewer)
      throw new Error(
        "Your browser blocked the document window. Allow pop-ups and try again.",
      );
    const response = await portalRequest<{ url: string }>(
      path,
      undefined,
      "GET",
    );
    viewer.location.href = response.url;
  } catch (error) {
    viewer?.close();
    alert(getError(error));
  }
}

function LoadState({
  error,
  retry,
}: {
  error?: Error | null;
  retry: () => void;
}) {
  if (error)
    return (
      <div className={`${card} p-6`} role="alert">
        <p className="font-semibold">Could not load this view</p>
        <p className="mt-1 text-sm text-[#69766c]">{error.message}</p>
        {/migration|relation|schema|setup/i.test(error.message) && (
          <p className="mt-3 rounded-xl bg-[#fff7e8] p-3 text-sm">
            Portal setup is required. Apply{" "}
            <code>supabase/migrations/20261029000000_employee_portal.sql</code>{" "}
            and retry.
          </p>
        )}
        <Button className={`${outline} mt-4`} onClick={retry}>
          Retry
        </Button>
      </div>
    );
  return (
    <div className="space-y-3" aria-label="Loading">
      <div className="h-24 animate-pulse rounded-2xl bg-[#f0f3f0]" />
      <div className="h-24 animate-pulse rounded-2xl bg-[#f0f3f0]" />
    </div>
  );
}

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
      <header className="sticky top-0 z-30 border-b border-[#e7ebe7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to={management ? "/team" : "/employee"}
            className="flex min-h-11 items-center gap-3"
            aria-label="ScopeClear home"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#314f3d] text-white">
              <span className="portal-mono text-xs">SC</span>
            </span>
            <span>
              <b className="block text-[15px] tracking-tight">ScopeClear</b>
              <small className="block text-[10px] uppercase tracking-[.14em] text-[#768178]">
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
                className={`min-h-11 rounded-xl px-3.5 py-3 text-sm font-medium ${active(to) ? "bg-[#edf3ee] text-[#314f3d]" : "text-[#67736a] hover:bg-[#f6f8f6]"}`}
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
          <div className="border-t border-[#edf0ed]">
            <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
              <Link
                to={mainAppHref}
                className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border border-[#d9e1db] bg-white px-3 text-sm font-semibold text-[#34483a] hover:bg-[#f5f8f5]"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Back to main app</span>
              </Link>
            </div>
          </div>
        )}
        {menu && (
          <nav className="grid grid-cols-2 gap-2 border-t border-[#e7ebe7] p-3 md:hidden">
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
              <p className="text-xs text-[#78847b]">Signed in as</p>
              <p className="text-sm font-semibold">{employee.name}</p>
            </div>
            <span className="rounded-full bg-[#edf3ee] px-3 py-1.5 text-xs font-semibold text-[#355441]">
              {roleLabels[employee.role]}
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
function UnreadDot() {
  const { data } = usePortal<EmployeeBootstrap>("/employee/bootstrap");
  const count = data?.notifications.filter((n) => !n.read_at).length ?? 0;
  return count > 0 ? (
    <span
      aria-label={`${count} unread`}
      className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#c96443] px-1 text-[9px] font-bold text-white ring-2 ring-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  ) : null;
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <EmployeePageTitle
      eyebrow={eyebrow}
      title={title}
      description={description}
      action={action}
    />
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return <EmptyState title={title} detail={detail} />;
}
function AssignmentCard({
  assignment,
  job,
  onClock,
  onOpen,
  busy = false,
}: {
  assignment: PortalAssignment;
  job?: PortalJob;
  onClock?: () => void;
  onOpen?: () => void;
  busy?: boolean;
}) {
  return (
    <article className={`${card} overflow-hidden`}>
      <div className="flex gap-3 p-4 sm:p-5">
        <div className="portal-mono flex w-[62px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#f1f5f1] py-2 text-xs text-[#3c5a45]">
          <b>{assignment.start_time?.slice(0, 5) || "—"}</b>
          <span className="my-1 h-px w-5 bg-[#cbd8cd]" />
          <span>{assignment.end_time?.slice(0, 5) || "—"}</span>
        </div>
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <span className="block truncate text-base font-bold">
            {job?.name ?? "Scheduled job"}
          </span>
          <span className="mt-1 block truncate text-sm text-[#78847b]">
            {job?.client_name ?? ""}
          </span>
          <span className="mt-2 flex items-center gap-1 text-xs text-[#69786d]">
            <MapPin className="h-3 w-3" />
            {job?.client_address || "Address to be confirmed"}
          </span>
        </button>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#9aa59c]" />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#edf0ed] px-4 py-3 sm:px-5">
        <span className="mr-auto text-xs text-[#7a867d]">
          {fmtDate(assignment.date)}
        </span>
        {job?.client_phone && (
          <a
            className={`${outline} !min-h-10 !px-3`}
            href={`tel:${job.client_phone}`}
          >
            Call client
          </a>
        )}
        {onClock && (
          <Button
            className={`${primary} !min-h-10 !px-3`}
            disabled={busy}
            onClick={onClock}
          >
            <Clock3 className="h-4 w-4" />
            {busy ? "Starting…" : "Clock in"}
          </Button>
        )}
      </div>
    </article>
  );
}

export function EmployeeHome({ week = false }: { week?: boolean }) {
  const path = "/employee/bootstrap";
  const q = usePortal<EmployeeBootstrap>(path);
  const refresh = useRefreshPortal();
  const nav = useNavigate();
  const data = q.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [gpsConsent, setGpsConsent] = useState(false);
  const [now, setNow] = useState(Date.now());
  const assignments = useMemo(
    () =>
      (data?.assignments ?? [])
        .filter((a) => (week ? a.date >= data!.today : a.date === data!.today))
        .sort((a, b) =>
          `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`),
        ),
    [data, week],
  );
  const running = data?.entries.find((e) => !e.ended_at);
  const hasRunning = Boolean(running);
  useEffect(() => {
    if (!hasRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasRunning]);
  const getGps = async () =>
    gpsConsent && "geolocation" in navigator
      ? new Promise<{ latitude: number; longitude: number } | undefined>(
          (resolve) =>
            navigator.geolocation.getCurrentPosition(
              (p) =>
                resolve({
                  latitude: p.coords.latitude,
                  longitude: p.coords.longitude,
                }),
              () => resolve(undefined),
              { timeout: 3000, maximumAge: 60000 },
            ),
        )
      : undefined;
  async function clockIn(project_id: string) {
    setBusy(project_id);
    try {
      const gps = await getGps();
      await portalRequest("/employee/clock-in", {
        project_id,
        ...(gps ? { gps } : {}),
      });
      await refresh();
    } catch (e) {
      alert(getError(e));
    } finally {
      setBusy(null);
    }
  }
  async function clockOut() {
    if (!running) return;
    const rawBreak = window.prompt("Unpaid break in minutes", "30");
    if (rawBreak === null) return;
    const break_minutes = Number(rawBreak);
    if (!Number.isInteger(break_minutes) || break_minutes < 0) {
      alert("Enter a whole number of break minutes.");
      return;
    }
    const note = window.prompt("Add a note for this shift (optional)") ?? "";
    try {
      const gps = await getGps();
      await portalRequest("/employee/clock-out", {
        entry_id: running.id,
        break_minutes,
        notes: note,
        ...(gps ? { gps } : {}),
      });
      await refresh();
    } catch (e) {
      alert(getError(e));
    }
  }
  return (
    <PortalLayout>
      <PageTitle
        eyebrow={week ? "Planning / next up" : "Field portal / today"}
        title={week ? "This week" : "Today"}
        description={
          week
            ? "Your upcoming booked work, in business local time."
            : "Your next job, contact details and work clock."
        }
        action={
          <Link className={outline} to="/employee/timesheets">
            <Clock3 className="h-4 w-4" />
            Timesheets
          </Link>
        }
      />
      {q.isLoading ? (
        <LoadState retry={() => q.refetch()} />
      ) : q.error ? (
        <LoadState error={q.error} retry={() => q.refetch()} />
      ) : (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-[1.3fr_.7fr]">
            <div className={`${card} portal-grid p-5 sm:p-6`}>
              <p className="portal-mono text-[10px] uppercase tracking-[.15em] text-[#76877b]">
                Business date · {data?.timezone}
              </p>
              <p className="mt-3 text-2xl font-bold text-[#304a37]">
                {fmtDate(data?.today)}
              </p>
              <p className="mt-1 text-sm text-[#718076]">
                {assignments.length
                  ? `${assignments.length} scheduled ${assignments.length === 1 ? "job" : "jobs"}`
                  : "No assignments on the board yet."}
              </p>
            </div>
            <div
              className={`${card} flex flex-wrap items-center justify-between gap-3 p-5`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#758178]">
                  Shift clock
                </p>
                <p className="mt-2 text-lg font-bold">
                  {running ? "On the clock" : "Not clocked in"}
                </p>
                <p className="mt-1 text-xs text-[#758178]">
                  {running
                    ? `Started ${fmtTime(running.started_at, data?.timezone)} · ${elapsed(running.started_at, now)}`
                    : "Location stays off unless you opt in."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="flex min-h-11 items-center gap-2 text-xs text-[#748077]">
                  <input
                    type="checkbox"
                    checked={gpsConsent}
                    onChange={(e) => setGpsConsent(e.target.checked)}
                  />
                  Include GPS
                </label>
                {running ? (
                  <Button
                    className={`${btn} bg-[#b85b40] text-white hover:bg-[#9c4934]`}
                    onClick={clockOut}
                  >
                    Clock out
                  </Button>
                ) : (
                  <Clock3 className="h-8 w-8 text-[#54705b]" />
                )}
              </div>
            </div>
          </section>
          {assignments.length === 0 ? (
            <Empty
              title={
                week ? "Nothing booked just yet" : "You are clear for today"
              }
              detail="When your manager adds you to a job, it will appear here with the site and schedule."
            />
          ) : (
            <div className="grid gap-3">
              {assignments.map((a) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  job={data?.jobs.find((j) => j.id === a.project_id)}
                  onOpen={() => nav(`/employee/jobs/${a.project_id}`)}
                  onClock={!running ? () => clockIn(a.project_id) : undefined}
                  busy={busy === a.project_id}
                />
              ))}
            </div>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className={outline} to="/employee/week">
              <CalendarDays className="h-4 w-4" />
              Upcoming work
            </Link>
            <Link className={outline} to="/employee/notifications">
              <Bell className="h-4 w-4" />
              Updates
            </Link>
          </div>
        </>
      )}
    </PortalLayout>
  );
}

export function EmployeeJob() {
  const { jobId = "" } = useParams();
  const q = usePortal<EmployeeJobDetail>(`/employee/jobs/${jobId}`, !!jobId);
  const refresh = useRefreshPortal();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState("during");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function savePhoto() {
    if (!file) return;
    setBusy(true);
    try {
      await uploadEmployeePhoto(jobId, file, caption, stage);
      setFile(null);
      setCaption("");
      await refresh();
    } catch (e) {
      alert(getError(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await portalRequest("/employee/notes", {
        project_id: jobId,
        body: note.trim(),
      });
      setNote("");
      await refresh();
    } catch (e) {
      alert(getError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PortalLayout>
      <Link
        to="/employee"
        className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#4f6b56]"
      >
        ← Back to Today
      </Link>
      {q.isLoading ? (
        <LoadState retry={() => q.refetch()} />
      ) : q.error ? (
        <LoadState error={q.error} retry={() => q.refetch()} />
      ) : (
        q.data && (
          <>
            <PageTitle
              eyebrow="Assigned job"
              title={q.data.job.name}
              description={`${q.data.job.client_name}${q.data.job.client_address ? ` · ${q.data.job.client_address}` : ""}`}
            />
            <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
              <div className="space-y-4">
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Site details</h2>
                  <p className="mt-2 text-sm text-[#718076]">
                    {q.data.job.client_address || "No site address provided."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {q.data.job.client_address && (
                      <a
                        className={outline}
                        target="_blank"
                        rel="noreferrer"
                        href={`https://maps.google.com/?q=${encodeURIComponent(q.data.job.client_address)}`}
                      >
                        <MapPin className="h-4 w-4" />
                        Directions
                      </a>
                    )}
                    {q.data.job.client_phone && (
                      <a
                        className={outline}
                        href={`tel:${q.data.job.client_phone}`}
                      >
                        Call {q.data.job.client_phone}
                      </a>
                    )}
                  </div>
                </section>
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Work notes</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#68766c]">
                    {q.data.job.employee_notes || "No specific site notes."}
                  </p>
                </section>
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Scope</h2>
                  {q.data.scope.length ? (
                    <ul className="mt-3 space-y-3">
                      {q.data.scope.map((s) => (
                        <li
                          key={s.id}
                          className="border-t border-[#edf0ed] pt-3"
                        >
                          <b className="text-sm">{s.title}</b>
                          {s.description && (
                            <p className="mt-1 text-sm text-[#748077]">
                              {s.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[#748077]">
                      No scope items shared with the crew.
                    </p>
                  )}
                </section>
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Approved variations</h2>
                  {q.data.variations.filter((v) => v.status === "approved")
                    .length ? (
                    <ul className="mt-3 space-y-3">
                      {q.data.variations
                        .filter((v) => v.status === "approved")
                        .map((v) => (
                          <li
                            key={v.id}
                            className="border-t border-[#edf0ed] pt-3"
                          >
                            <b className="text-sm">{v.title}</b>
                            {v.description && (
                              <p className="mt-1 text-sm text-[#748077]">
                                {v.description}
                              </p>
                            )}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[#748077]">
                      No approved variations published.
                    </p>
                  )}
                </section>
              </div>
              <div className="min-w-0 space-y-4">
                <section className={`${card} min-w-0 p-5`}>
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-[#49664f]" />
                    <h2 className="font-bold">Site photos</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#7c887f]">
                    Private to your team · JPG, PNG or WebP up to 10 MB
                  </p>
                  <div className="mt-4 min-w-0 space-y-3">
                    <Label htmlFor="photo-file">Photo</Label>
                    <Input
                      id="photo-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="min-h-11 min-w-0 max-w-full"
                    />
                    <Label htmlFor="camera-photo">Take photo</Label>
                    <Input
                      id="camera-photo"
                      type="file"
                      capture="environment"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="min-h-11 min-w-0 max-w-full"
                    />
                    {file && (
                      <p className="break-all text-xs text-[#68766c]">
                        Selected: {file.name}
                      </p>
                    )}
                    <Label htmlFor="photo-caption">Caption</Label>
                    <Input
                      id="photo-caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="What should the team know?"
                    />
                    <Label htmlFor="photo-stage">Stage</Label>
                    <select
                      id="photo-stage"
                      className={field}
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
                    >
                      <option value="before">Before</option>
                      <option value="during">During</option>
                      <option value="after">After</option>
                    </select>
                    <Button
                      className={`${primary} w-full`}
                      onClick={savePhoto}
                      disabled={!file || busy}
                    >
                      {busy ? "Uploading…" : "Add photo"}
                    </Button>
                  </div>
                </section>
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Private update</h2>
                  <p className="mt-1 text-xs text-[#7c887f]">
                    Only your team can see this note.
                  </p>
                  <Textarea
                    aria-label="Job update note"
                    className="mt-3 min-h-24"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Record progress, blockers or materials needed…"
                  />
                  <Button
                    className={`${primary} mt-3 w-full`}
                    onClick={saveNote}
                    disabled={!note.trim() || busy}
                  >
                    Save update
                  </Button>
                </section>
                <PhotoGallery documents={q.data.documents} employee />
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Shared documents</h2>
                  {q.data.documents.filter((d) => d.employee_visible).length ? (
                    <div className="mt-3 space-y-2">
                      {q.data.documents
                        .filter((d) => d.employee_visible)
                        .map((d) => (
                          <button
                            key={d.id}
                            onClick={() =>
                              void openCapabilityUrl(
                                `/employee/documents/${d.id}/url`,
                              )
                            }
                            className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-[#edf0ed] px-3 text-left text-sm"
                          >
                            <FileText className="h-4 w-4 text-[#59725e]" />
                            <span className="truncate">
                              {d.display_name || d.file_name}
                            </span>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[#748077]">
                      No documents published for staff.
                    </p>
                  )}
                </section>
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Team updates</h2>
                  {q.data.notes.length ? (
                    <ul className="mt-3 space-y-3">
                      {q.data.notes.map((n) => (
                        <li
                          key={n.id}
                          className="border-t border-[#edf0ed] pt-3"
                        >
                          <p className="text-sm">{n.body}</p>
                          <small className="mt-1 block text-[#849087]">
                            {fmtDate(n.created_at)}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[#748077]">
                      No updates yet.
                    </p>
                  )}
                </section>
              </div>
            </div>
          </>
        )
      )}
    </PortalLayout>
  );
}

export function PhotoGallery({
  documents,
  employee = false,
}: {
  documents: PortalDocument[];
  employee?: boolean;
}) {
  return <EmployeePhotoGallery documents={documents} employee={employee} />;
}

export function EmployeeLogin() {
  const { signIn, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    nav("/employee", { replace: true });
  }
  if (user) return <NavigateEmployee />;
  return (
    <div
      className={`${shell} portal-grid flex min-h-[100dvh] items-center justify-center p-4`}
    >
      <div className={`${card} portal-enter w-full max-w-md p-6 sm:p-9`}>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 font-bold"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#314f3d] text-xs text-white">
            SC
          </span>
          ScopeClear
        </Link>
        <p className="portal-mono mt-8 text-[10px] uppercase tracking-[.16em] text-[#829087]">
          Employee sign in
        </p>
        <h1 className="mt-2 text-3xl font-bold">Welcome to site.</h1>
        <p className="mt-2 text-sm text-[#738078]">
          Sign in with the email address on your invitation.
        </p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="emp-email">Email address</Label>
            <Input
              id="emp-email"
              className={`${field} mt-1.5`}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="emp-password">Password</Label>
            <Input
              id="emp-password"
              className={`${field} mt-1.5`}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-[#fff1ed] p-3 text-sm text-[#a34632]"
            >
              {error}
            </p>
          )}
          <Button className={`${primary} w-full`} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-[#78847b]">
          Have an invite?{" "}
          <Link
            className="font-semibold text-[#385743] underline"
            to={`/employee/accept${location.search}`}
          >
            Accept invitation
          </Link>
        </p>
      </div>
    </div>
  );
}
function NavigateEmployee() {
  return <Navigate to="/employee" replace />;
}

export function EmployeeGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const portal = usePortalSession(!!user);
  if (loading || (user && portal.isLoading))
    return (
      <div className={`${shell} min-h-[100dvh] p-6`}>
        <div className="mx-auto max-w-4xl space-y-3 pt-12">
          <div className="h-12 animate-pulse rounded-xl bg-[#edf1ed]" />
          <div className="h-32 animate-pulse rounded-2xl bg-[#edf1ed]" />
        </div>
      </div>
    );
  if (!user) return <Navigate to="/employee/login" replace />;
  if (portal.error)
    return (
      <div className={`${shell} min-h-[100dvh] p-6`}>
        <div className="mx-auto mt-12 max-w-lg rounded-2xl border p-6">
          <h1 className="text-xl font-bold">Portal setup needed</h1>
          <p className="mt-2 text-sm text-[#68766c]">{portal.error.message}</p>
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

export function EmployeeAccept() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const q = usePortal<{ name: string; email: string; expires_at: string }>(
    `/employee/invitations/${encodeURIComponent(token)}`,
    !!token,
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(false);
  const { signIn } = useAuth();
  const nav = useNavigate();
  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await portalRequest("/employee/invitations/accept", { token, password });
      const login = await signIn(q.data!.email, password);
      if (login.error) throw login.error;
      nav("/employee", { replace: true });
    } catch (err) {
      const msg = getError(err);
      if (/already|registered|exists|conflict/i.test(msg)) setExisting(true);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`${shell} portal-grid flex min-h-[100dvh] items-center justify-center p-4`}
    >
      <div className={`${card} w-full max-w-md p-6 sm:p-9`}>
        <Link to="/" className="font-bold">
          ScopeClear
        </Link>
        <p className="portal-mono mt-8 text-[10px] uppercase tracking-[.16em] text-[#829087]">
          Team invitation
        </p>
        {!token ? (
          <div className="mt-5">
            <h1 className="text-2xl font-bold">Invitation link missing</h1>
            <p className="mt-2 text-sm text-[#738078]">
              Open the full link from your invitation email.
            </p>
          </div>
        ) : q.isLoading ? (
          <LoadState retry={() => q.refetch()} />
        ) : q.error ? (
          <LoadState error={q.error} retry={() => q.refetch()} />
        ) : (
          q.data && (
            <>
              <h1 className="mt-2 text-2xl font-bold">
                Join {q.data.name ? `${q.data.name}’s team` : "your team"}
              </h1>
              <p className="mt-2 text-sm text-[#738078]">
                Invitation for <b>{q.data.email}</b>. Expires{" "}
                {fmtDate(q.data.expires_at)}.
              </p>
              {existing ? (
                <form
                  className="mt-6 space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    const r = await signIn(q.data!.email, password);
                    if (r.error) {
                      setError(r.error.message);
                      setBusy(false);
                      return;
                    }
                    try {
                      await portalRequest("/employee/invitations/accept", {
                        token,
                      });
                      nav("/employee", { replace: true });
                    } catch (err) {
                      setError(getError(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Label htmlFor="existing-pass">
                    Existing account password
                  </Label>
                  <Input
                    id="existing-pass"
                    className={field}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button className={`${primary} w-full`} disabled={busy}>
                    {busy ? "Connecting…" : "Sign in and accept"}
                  </Button>
                </form>
              ) : (
                <form className="mt-6 space-y-3" onSubmit={accept}>
                  <Label htmlFor="new-pass">Create a password</Label>
                  <Input
                    id="new-pass"
                    className={field}
                    type="password"
                    minLength={12}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-[#7c887f]">
                    At least 12 characters.
                  </p>
                  <Button className={`${primary} w-full`} disabled={busy}>
                    {busy ? "Accepting…" : "Accept invitation"}
                  </Button>
                </form>
              )}
              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-[#fff1ed] p-3 text-sm text-[#a34632]"
                >
                  {error}
                </p>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}

export function EmployeeTimesheets() {
  const q = usePortal<EmployeeBootstrap>("/employee/bootstrap");
  const refresh = useRefreshPortal();
  const [mode, setMode] = useState<"manual" | "duration">("manual");
  const [job, setJob] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [duration, setDuration] = useState("8");
  const [breakMins, setBreakMins] = useState("30");
  const [notes, setNotes] = useState("");
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortalTimeEntry | null>(
    null,
  );
  const data = q.data;
  const ws = selectedWeek ?? weekStart(data?.today ?? today());
  const entries = (data?.entries ?? [])
    .filter((e) => weekStart(e.work_date) === ws)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const entryMinutes = (e: PortalTimeEntry) =>
    e.ended_at
      ? (e.paid_minutes ??
        Math.max(
          0,
          Math.round(
            (Date.parse(e.ended_at) - Date.parse(e.started_at)) / 60000,
          ) - e.break_minutes,
        ))
      : 0;
  const dayTotals = Array.from(new Set(entries.map((e) => e.work_date))).map(
    (day) => ({
      day,
      minutes: entries
        .filter((e) => e.work_date === day)
        .reduce((n, e) => n + entryMinutes(e), 0),
    }),
  );
  const jobTotals = (data?.jobs ?? [])
    .map((j) => ({
      name: j.name,
      minutes: entries
        .filter((e) => e.project_id === j.id)
        .reduce((n, e) => n + entryMinutes(e), 0),
    }))
    .filter((j) => j.minutes > 0);
  const total = entries.reduce((sum, e) => sum + entryMinutes(e), 0);
  function changeWeek(amount: number) {
    const date = new Date(`${ws}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount * 7);
    setSelectedWeek(weekStart(date.toISOString().slice(0, 10)));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (!job) throw new Error("Choose a job first.");
      let started: string, ended: string;
      const tz = data?.timezone || "Australia/Sydney";
      if (mode === "duration") {
        const hours = Number(duration);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24)
          throw new Error("Enter a duration between 0 and 24 hours.");
        started = localDateTimeToUtc(start, tz);
        ended = new Date(Date.parse(started) + hours * 3600000).toISOString();
      } else {
        started = localDateTimeToUtc(start, tz);
        ended = localDateTimeToUtc(end, tz);
      }
      paidMinutes(started, ended, Number(breakMins));
      const payload = {
        project_id: job,
        started_at: started,
        ended_at: ended,
        break_minutes: Number(breakMins),
        notes,
      };
      await portalRequest(
        editingEntry ? `/employee/time/${editingEntry}` : "/employee/time",
        payload,
        editingEntry ? "PATCH" : "POST",
      );
      setStart("");
      setEnd("");
      setNotes("");
      setEditingEntry(null);
      await refresh();
      setMessage(
        editingEntry ? "Draft time entry updated." : "Time entry saved.",
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }
  function editEntry(entry: PortalTimeEntry) {
    if (entry.status !== "draft" || !entry.ended_at) return;
    const tz = data?.timezone || "Australia/Sydney";
    setEditingEntry(entry.id);
    setJob(entry.project_id);
    setMode("manual");
    setStart(datetimeForZone(entry.started_at, tz));
    setEnd(datetimeForZone(entry.ended_at, tz));
    setBreakMins(String(entry.break_minutes));
    setNotes(entry.notes);
    setError("");
    setMessage("");
    document
      .getElementById("employee-entry-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("entry-start")?.focus();
  }
  async function submitWeek() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await portalRequest("/employee/submit", { week_start: ws });
      await refresh();
      setMessage("Timesheet submitted for review.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }
  const submitted = data?.submissions.find((s) => s.week_start === ws);
  const weekLocked =
    submitted?.status === "submitted" || submitted?.status === "approved";
  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await portalRequest(`/employee/time/${deleteTarget.id}`, {}, "DELETE");
      setDeleteTarget(null);
      await refresh();
      setMessage("Draft time entry deleted.");
      window.setTimeout(
        () => document.getElementById("selected-week-title")?.focus(),
        0,
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PortalLayout>
      <PageTitle
        eyebrow="Hours / your record"
        title="Timesheets"
        description="Record site hours, check your week and submit for review."
        action={
          <Link to="/employee/week" className={outline}>
            <CalendarDays className="h-4 w-4" />
            My schedule
          </Link>
        }
      />
      {q.isLoading ? (
        <LoadState retry={() => q.refetch()} />
      ) : q.error ? (
        <LoadState error={q.error} retry={() => q.refetch()} />
      ) : (
        data && (
          <>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-xl bg-[#fff1ed] p-3 text-sm text-[#a34632]"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="mb-4 rounded-xl bg-[#edf5ee] p-3 text-sm text-[#3f6248]"
              >
                {message}
              </p>
            )}
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1.2fr]">
              <div className={`${card} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <small className="text-xs text-[#7c887f]">
                      Selected week
                    </small>
                    <p className="portal-mono mt-1 text-lg font-bold">
                      {fmtDate(ws)}
                    </p>
                  </div>
                  <span className="text-xs text-[#78847b]">
                    {entries.length} recorded{" "}
                    {entries.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className={`${outline} !min-h-10 !px-3`}
                    onClick={() => changeWeek(-1)}
                  >
                    Previous week
                  </Button>
                  <label className="sr-only" htmlFor="employee-timesheet-week">
                    Select week
                  </label>
                  <input
                    id="employee-timesheet-week"
                    type="date"
                    className={`${field} !min-h-10 min-w-[145px] flex-1`}
                    value={ws}
                    onChange={(event) => {
                      if (event.target.value)
                        setSelectedWeek(weekStart(event.target.value));
                    }}
                  />
                  <Button
                    type="button"
                    className={`${outline} !min-h-10 !px-3`}
                    onClick={() => setSelectedWeek(weekStart(data.today))}
                  >
                    Current week
                  </Button>
                </div>
              </div>
              <div
                className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}
              >
                <div>
                  <small className="text-xs text-[#7c887f]">
                    Week submission
                  </small>
                  <p className="mt-1 font-bold capitalize">
                    {submitted?.status ?? "Draft"}
                  </p>
                </div>
                {!submitted || submitted.status === "rejected" ? (
                  <Button
                    className={`${primary} !px-3`}
                    onClick={submitWeek}
                    disabled={busy || entries.length === 0}
                  >
                    {busy ? "Sending…" : "Submit week"}
                  </Button>
                ) : submitted.status === "submitted" ? (
                  <span className="rounded-full bg-[#fff3df] px-3 py-1 text-xs font-semibold text-[#96652a]">
                    In review
                  </span>
                ) : (
                  <span className="rounded-full bg-[#edf5ee] px-3 py-1 text-xs font-semibold text-[#44654a]">
                    Approved
                  </span>
                )}
              </div>
            </div>
            <TimesheetSummary
              entries={entries}
              hourlyRate={data.hourly_rate}
              showRate
            />
            <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
              <form
                id="employee-entry-form"
                className={`${card} scroll-mt-24 p-5 sm:p-6`}
                onSubmit={save}
              >
                <h2 className="text-lg font-bold">
                  {editingEntry ? "Edit draft time" : "Add work time"}
                </h2>
                <p className="mt-1 text-sm text-[#78847b]">
                  Use the business timezone: {data.timezone}.
                </p>
                <div className="mt-5 space-y-4">
                  <div>
                    <Label htmlFor="entry-job">Job</Label>
                    <select
                      id="entry-job"
                      className={`${field} mt-1.5`}
                      value={job}
                      onChange={(e) => setJob(e.target.value)}
                      required
                    >
                      <option value="">Choose assigned job</option>
                      {data.jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 rounded-xl bg-[#f2f5f2] p-1">
                    <button
                      type="button"
                      className={`min-h-10 rounded-lg text-sm font-semibold ${mode === "manual" ? "bg-white shadow-sm" : ""}`}
                      onClick={() => setMode("manual")}
                    >
                      Start & finish
                    </button>
                    <button
                      type="button"
                      className={`min-h-10 rounded-lg text-sm font-semibold ${mode === "duration" ? "bg-white shadow-sm" : ""}`}
                      onClick={() => setMode("duration")}
                    >
                      Duration
                    </button>
                  </div>
                  <div>
                    <Label htmlFor="entry-start">
                      Start · local date and time
                    </Label>
                    <Input
                      id="entry-start"
                      type="datetime-local"
                      className={`${field} mt-1.5`}
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      required
                    />
                  </div>
                  {mode === "manual" ? (
                    <div>
                      <Label htmlFor="entry-end">
                        Finish · local date and time
                      </Label>
                      <Input
                        id="entry-end"
                        type="datetime-local"
                        className={`${field} mt-1.5`}
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="entry-duration">Hours from start</Label>
                      <Input
                        id="entry-duration"
                        type="number"
                        min="0.1"
                        max="24"
                        step=".25"
                        className={`${field} mt-1.5`}
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="entry-break">Unpaid break · minutes</Label>
                    <Input
                      id="entry-break"
                      type="number"
                      min="0"
                      step="1"
                      className={`${field} mt-1.5`}
                      value={breakMins}
                      onChange={(e) => setBreakMins(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="entry-notes">Work notes</Label>
                    <Textarea
                      id="entry-notes"
                      className={`${field} mt-1.5`}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="What did you work on?"
                    />
                  </div>
                  <Button className={`${primary} w-full`} disabled={busy}>
                    {busy
                      ? "Saving…"
                      : editingEntry
                        ? "Update draft"
                        : "Save time entry"}
                  </Button>
                  {editingEntry && (
                    <Button
                      type="button"
                      className={`${outline} w-full`}
                      disabled={busy}
                      onClick={() => {
                        setEditingEntry(null);
                        setStart("");
                        setEnd("");
                        setNotes("");
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
              <section className={`${card} p-5 sm:p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      id="selected-week-title"
                      tabIndex={-1}
                      className="text-lg font-bold"
                    >
                      Selected week
                    </h2>
                    <p className="mt-1 text-sm text-[#78847b]">
                      {entries.length}{" "}
                      {entries.length === 1 ? "entry" : "entries"} ·{" "}
                      {mins(Math.round(total))} paid time
                    </p>
                  </div>
                  <span className="portal-mono text-xs text-[#718076]">
                    {fmtDate(ws)}
                  </span>
                </div>
                {entries.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dayTotals.map((d) => (
                      <span
                        key={d.day}
                        className="rounded-full bg-[#f2f5f2] px-3 py-1.5 text-xs text-[#5c6e61]"
                      >
                        {fmtDate(d.day)}{" "}
                        <b className="portal-mono ml-1">
                          {mins(Math.round(d.minutes))}
                        </b>
                      </span>
                    ))}
                    {jobTotals.map((j) => (
                      <span
                        key={j.name}
                        className="rounded-full bg-[#edf3ee] px-3 py-1.5 text-xs text-[#45634d]"
                      >
                        {j.name}{" "}
                        <b className="portal-mono ml-1">
                          {mins(Math.round(j.minutes))}
                        </b>
                      </span>
                    ))}
                  </div>
                )}
                {entries.length ? (
                  <div className="mt-4 space-y-2">
                    {entries.map((e) => (
                      <div
                        key={e.id}
                        className="rounded-xl border border-[#edf0ed] p-3"
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {data.jobs.find((j) => j.id === e.project_id)
                                ?.name ?? "Job"}
                            </p>
                            <p className="mt-1 text-xs text-[#7a867d]">
                              {fmtDate(e.work_date)} ·{" "}
                              {fmtTime(e.started_at, data.timezone)} –{" "}
                              {fmtTime(e.ended_at, data.timezone)} ·{" "}
                              {e.break_minutes}m unpaid break
                            </p>
                            {!e.ended_at && (
                              <p className="mt-1 text-xs font-medium text-[#8a633f]">
                                Running clock · clock out before editing or
                                deleting.
                              </p>
                            )}
                            {e.notes && (
                              <p className="mt-2 text-sm text-[#65736a]">
                                {e.notes}
                              </p>
                            )}
                            {(e.status !== "draft" || weekLocked) && (
                              <p className="mt-2 text-xs text-[#7b6a50]">
                                This week is locked. Ask your supervisor to
                                reopen it before corrections.
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-[#f1f4f1] px-2 py-1 text-[10px] font-semibold capitalize">
                              {e.status}
                            </span>
                            {e.status === "draft" &&
                              e.ended_at &&
                              !weekLocked && (
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    type="button"
                                    className={`${outline} !min-h-10 !px-3`}
                                    disabled={busy}
                                    onClick={() => editEntry(e)}
                                  >
                                    Edit time
                                  </Button>
                                  <Button
                                    type="button"
                                    className={`${btn} !min-h-10 !px-3 border border-[#e7c9bf] bg-[#fff8f5] text-[#a34632] hover:bg-[#fff0eb]`}
                                    disabled={busy}
                                    onClick={() => setDeleteTarget(e)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <Empty
                      title="No hours logged"
                      detail="Add your first time entry for this week. Only your team sees your hours and notes."
                    />
                  </div>
                )}
                <div className="mt-6 border-t border-[#edf0ed] pt-5">
                  <h3 className="font-semibold">Review history</h3>
                  {data.submissions.length ? (
                    <div className="mt-2 space-y-2">
                      {data.submissions.map((s) => (
                        <div
                          key={s.id}
                          className="rounded-xl bg-[#f6f8f6] p-3 text-sm"
                        >
                          <div className="flex justify-between">
                            <span>Week of {fmtDate(s.week_start)}</span>
                            <b className="capitalize">{s.status}</b>
                          </div>
                          {s.review_comment && (
                            <p className="mt-2 text-[#758178]">
                              {s.review_comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[#78847b]">
                      Nothing submitted yet.
                    </p>
                  )}
                </div>
              </section>
            </div>
            {deleteTarget && (
              <div
                role="presentation"
                className="fixed inset-0 z-50 grid place-items-center bg-[#1d2a21]/45 p-4"
                onMouseDown={(event) =>
                  event.target === event.currentTarget &&
                  !busy &&
                  setDeleteTarget(null)
                }
                onKeyDown={(event) =>
                  event.key === "Escape" && !busy && setDeleteTarget(null)
                }
              >
                <div
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="employee-delete-title"
                  aria-describedby="employee-delete-description"
                  className={`${card} w-full max-w-md p-5`}
                >
                  <h2 id="employee-delete-title" className="text-xl font-bold">
                    Delete draft entry?
                  </h2>
                  <p
                    id="employee-delete-description"
                    className="mt-2 text-sm leading-5 text-[#718076]"
                  >
                    This removes your {fmtDate(deleteTarget.work_date)} time
                    entry from your timesheet. This cannot be undone.
                  </p>
                  {error && (
                    <p
                      role="alert"
                      className="mt-3 rounded-xl bg-[#fff1ed] p-3 text-sm text-[#a34632]"
                    >
                      {error}
                    </p>
                  )}
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      autoFocus
                      className={outline}
                      disabled={busy}
                      onClick={() => setDeleteTarget(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className={`${btn} border border-[#e7c9bf] bg-[#a34632] text-white hover:bg-[#8f3c2d]`}
                      disabled={busy}
                      onClick={() => void remove()}
                    >
                      {busy ? "Deleting…" : "Delete entry"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <EmployeeReviewQueue
              enabled={data.permissions.review_timesheets}
              employeeId={data.employee.id}
              timezone={data.timezone}
            />
          </>
        )
      )}
    </PortalLayout>
  );
}

function EmployeeReviewQueue({
  enabled,
  employeeId,
  timezone,
}: {
  enabled: boolean;
  employeeId: string;
  timezone: string;
}) {
  const q = usePortal<PortalReviews>("/employee/reviews", enabled);
  const refresh = useRefreshPortal();
  const [selected, setSelected] = useState<PortalSubmission | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | "reopen">(
    "approved",
  );
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!enabled) return null;
  function begin(
    submission: PortalSubmission,
    next: "approved" | "rejected" | "reopen",
  ) {
    setError("");
    setComment("");
    setSelected(submission);
    setDecision(next);
  }
  async function review(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (decision !== "approved" && !comment.trim()) {
      setError("Add a comment before denying or reopening this week.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await portalRequest("/team/review", {
        submission_id: selected.id,
        decision,
        comment: comment.trim(),
      });
      setSelected(null);
      setComment("");
      await refresh();
      setMessage(
        decision === "approved"
          ? "Timesheet approved."
          : decision === "rejected"
            ? "Timesheet denied. The employee can correct and resubmit."
            : "Week reopened for corrections.",
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }
  const reviewable =
    q.data?.submissions.filter((s) => s.employee_id !== employeeId) ?? [];
  return (
    <section className={`${card} mt-6 overflow-hidden`}>
      <div className="border-b border-[#edf0ed] p-5">
        <h2 className="font-bold">Supervisor reviews</h2>
        <p className="mt-1 text-sm text-[#78847b]">
          Review submitted weeks and all their entries within your authorised
          scope. You cannot approve your own week.
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="border-b border-[#edf0ed] bg-[#edf5ee] px-4 py-3 text-sm text-[#3f6248]"
        >
          {message}
        </p>
      )}
      {q.isLoading ? (
        <div className="p-5">
          <div className="h-14 animate-pulse rounded-xl bg-[#f0f3f0]" />
        </div>
      ) : q.error ? (
        <div className="p-5" role="alert">
          <p className="text-sm text-[#a34632]">{q.error.message}</p>
          <Button className={`${outline} mt-3`} onClick={() => q.refetch()}>
            Retry
          </Button>
        </div>
      ) : reviewable.length ? (
        reviewable.map((s) => {
          const employee = q.data!.employees.find(
            (e) => e.id === s.employee_id,
          );
          const entries = q.data!.entries.filter(
            (e) =>
              e.employee_id === s.employee_id &&
              weekStart(e.work_date) === s.week_start,
          );
          const total = entries.reduce(
            (n, e) =>
              n +
              (e.ended_at
                ? Math.max(
                    0,
                    (Date.parse(e.ended_at) - Date.parse(e.started_at)) /
                      60000 -
                      e.break_minutes,
                  )
                : 0),
            0,
          );
          return (
            <div
              key={s.id}
              className="border-b border-[#edf0ed] p-4 last:border-0"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <b>{employee?.name ?? "Team member"}</b>
                  <p className="mt-1 text-xs text-[#78847b]">
                    Week of {fmtDate(s.week_start)} · {entries.length} entries ·{" "}
                    {mins(total)}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-[#f2f5f2] px-2.5 py-1 text-xs font-semibold capitalize">
                    {s.status}
                  </span>
                </div>
                {s.status === "submitted" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className={outline}
                      onClick={() => begin(s, "reopen")}
                    >
                      Reopen week
                    </Button>
                    <Button
                      className={outline}
                      onClick={() => begin(s, "rejected")}
                    >
                      Deny week
                    </Button>
                    <Button
                      className={primary}
                      onClick={() => begin(s, "approved")}
                    >
                      <Check className="h-4 w-4" />
                      Approve week
                    </Button>
                  </div>
                ) : (
                  <Button
                    className={outline}
                    onClick={() => begin(s, "reopen")}
                  >
                    Reopen week
                  </Button>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl bg-[#f6f8f6] p-3 text-xs"
                  >
                    <b>
                      {q.data!.jobs.find((j) => j.id === entry.project_id)
                        ?.name ?? "Job"}
                    </b>
                    <span className="ml-2 text-[#78847b]">
                      {fmtDate(entry.work_date)} ·{" "}
                      {fmtTime(entry.started_at, timezone)}–
                      {fmtTime(entry.ended_at, timezone)} ·{" "}
                      {entry.break_minutes}m break
                    </span>
                    {entry.notes && (
                      <p className="mt-2 text-[#65736a]">{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
              {s.review_comment && (
                <p className="mt-3 text-sm text-[#78847b]">
                  {s.review_comment}
                </p>
              )}
            </div>
          );
        })
      ) : (
        <div className="p-8 text-center text-sm text-[#78847b]">
          No team submissions need review.
        </div>
      )}
      {selected && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-[#1d2a21]/45 p-4"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !busy && setSelected(null)
          }
          onKeyDown={(event) =>
            event.key === "Escape" && !busy && setSelected(null)
          }
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-review-title"
            className={`${card} max-h-[90dvh] w-full max-w-md overflow-y-auto p-5`}
            onSubmit={review}
          >
            <h3 id="employee-review-title" className="text-xl font-bold">
              {decision === "approved"
                ? "Approve timesheet"
                : decision === "rejected"
                  ? "Deny timesheet"
                  : "Reopen week for corrections"}
            </h3>
            <p className="mt-2 text-sm leading-5 text-[#718076]">
              {decision === "reopen"
                ? "Reopening unlocks the week. If it was approved, posted job labour is reversed. Correct the week, then resubmit it for approval."
                : `Week of ${fmtDate(selected.week_start)}. ${decision === "approved" ? "Approval confirms these hours for posting to job labour." : "Denying returns this week for corrections and resubmission."} Rates are never shown in this review.`}
            </p>
            <Label htmlFor="employee-review-comment" className="mt-4 block">
              Comment {decision === "approved" ? "(optional)" : "(required)"}
            </Label>
            <Textarea
              autoFocus
              id="employee-review-comment"
              className="mt-1.5 min-h-24"
              required={decision !== "approved"}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Write a clear note for the employee…"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-[#a34632]">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button
                type="button"
                className={outline}
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
              <Button
                className={primary}
                disabled={busy || (decision !== "approved" && !comment.trim())}
              >
                {busy
                  ? "Saving…"
                  : decision === "approved"
                    ? "Approve week"
                    : decision === "rejected"
                      ? "Deny and return"
                      : "Reopen week"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export function EmployeeNotifications() {
  const q = usePortal<EmployeeBootstrap>("/employee/bootstrap");
  const refresh = useRefreshPortal();
  async function mark(n: PortalNotification) {
    if (n.read_at) return;
    try {
      await portalRequest(`/employee/notifications/${n.id}/read`, {});
      await refresh();
    } catch (err) {
      alert(getError(err));
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
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-[#c8d0ca]" : "bg-[#d37b4d]"}`}
                />
                <span className="min-w-0 flex-1">
                  <b className="block">{n.title}</b>
                  <span className="mt-1 block text-sm text-[#6f7c72]">
                    {n.body}
                  </span>
                  <small className="mt-2 block text-[#879188]">
                    {fmtDate(n.created_at)}
                  </small>
                </span>
                {!n.read_at && (
                  <span className="self-center text-xs font-semibold text-[#45634d]">
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
