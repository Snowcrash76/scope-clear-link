import { useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  Eye,
  EyeOff,
  Mail,
  MoreVertical,
  Pencil,
  Save,
  ShieldCheck,
  UserPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  usePortal,
  usePortalSession,
  useRefreshPortal,
  portalRequest,
} from "@/hooks/useEmployeePortal";
import { PhotoGallery } from "@/components/EmployeePortalUI";
import { PageLayout } from "@/components/PageLayout";
import { TimesheetSummary } from "@/components/TimesheetSummary";
import { AssignmentList as TeamAssignmentList } from "@/components/team/AssignmentList";
import type {
  TeamBootstrap,
  EmployeeRole,
  OperationalPermissions,
  PortalAssignment,
  PortalSubmission,
  PortalTimeEntry,
} from "../../shared/employeePortal";
import {
  defaultPermissions,
  permissionNames,
  roleLabels,
  localDate,
  localDateTimeToUtc,
  paidMinutes,
  weekStart,
} from "../../shared/employeePortal";

const card =
  "rounded-2xl border border-[#e5e9e5] bg-white shadow-[0_3px_14px_rgba(33,54,43,.045)]";
const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50";
const primary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;
const outline = `${btn} border border-input bg-background text-foreground hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;
const field =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please retry.";
const showDate = (s: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${s.slice(0, 10)}T12:00:00`));
const showTime = (s: string | null, timezone = "Australia/Sydney") =>
  s
    ? new Intl.DateTimeFormat("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(s))
    : "Running";
function trapModalFocus(
  event: React.KeyboardEvent<HTMLDivElement>,
  close: () => void,
  busy = false,
) {
  if (event.key === "Escape") {
    if (!busy) {
      event.preventDefault();
      close();
    }
    return;
  }
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget.querySelector<HTMLElement>(
    '[role="dialog"],[role="alertdialog"]',
  );
  const focusable = dialog
    ? Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0)
    : [];
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!dialog?.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  }
}
function TeamLoad({
  error,
  retry,
}: {
  error?: Error | null;
  retry: () => void;
}) {
  const [setup, setSetup] = useState<{
    sql: string;
    editor_url: string;
  } | null>(null);
  const [setupError, setSetupError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  async function loadSetup() {
    setLoading(true);
    setSetupError("");
    try {
      setSetup(
        await portalRequest<{ sql: string; editor_url: string }>("/team/setup"),
      );
    } catch (e) {
      setSetupError(
        e instanceof Error ? e.message : "Setup instructions could not load.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function copySetup() {
    try {
      await navigator.clipboard.writeText(setup!.sql);
      setCopied(true);
    } catch {
      setSetupError(
        "Select and copy the SQL text below. Your browser did not allow clipboard access.",
      );
    }
  }
  if (!error)
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f3f0]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f3f0]" />
      </div>
    );
  return (
    <div role="alert" className={`${card} p-6`}>
      <b>Could not load team data</b>
      <p className="mt-1 text-sm text-[#718076]">{error.message}</p>
      {/migration|relation|setup/i.test(error.message) && (
        <details className="mt-3 rounded-lg bg-[#fff7e8] p-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            Database setup instructions
          </summary>
          <p>
            Publish the matching application build and apply this migration
            together during a maintenance window. Existing client project links
            will stop working and must be resent. Do not apply it while your
            published app still runs the older code.
          </p>
          <p className="mt-2 break-words">
            Migration:{" "}
            <code>supabase/migrations/20261029000000_employee_portal.sql</code>
          </p>
          {!setup ? (
            <Button
              type="button"
              className={`${outline} mt-3`}
              disabled={loading}
              onClick={loadSetup}
            >
              {loading ? "Loading…" : "Get setup SQL"}
            </Button>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" className={outline} onClick={copySetup}>
                  {copied ? "Copied" : "Copy setup SQL"}
                </Button>
                <a
                  className={outline}
                  href={setup.editor_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Supabase SQL editor
                </a>
              </div>
              <label className="mt-3 block">
                Setup SQL
                <textarea
                  className={`${field} mt-1 min-h-40 font-mono text-xs`}
                  readOnly
                  value={setup.sql}
                  rows={8}
                />
              </label>
            </>
          )}
          {setupError && <p className="mt-2 text-red-700">{setupError}</p>}
        </details>
      )}
      <Button onClick={retry} className={`${outline} mt-4`}>
        Retry
      </Button>
    </div>
  );
}

export function TeamHome({
  panel,
  embedded = false,
}: {
  panel?: "staff" | "timesheets" | "updates";
  embedded?: boolean;
}) {
  const params = useParams();
  const jobId = params.id ?? params.jobId;
  const routePanel = params.panel;
  const activePanel =
    panel ??
    (routePanel === "employee-updates"
      ? "updates"
      : routePanel === "staff" || routePanel === "timesheets"
        ? routePanel
        : undefined);
  const location = useLocation().pathname;
  const filterJob = jobId;
  const path = `/team/bootstrap${filterJob ? `?job_id=${encodeURIComponent(filterJob)}` : ""}`;
  const q = usePortal<TeamBootstrap>(path);
  const refresh = useRefreshPortal();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const session = usePortalSession();
  const isAdmin = Boolean(session.data?.canManageTeam);
  const [staff, setStaff] = useState({
    name: "",
    email: "",
    role: "labourer" as EmployeeRole,
    hourly_rate: "",
  });
  const [addOpen, setAddOpen] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<
    TeamBootstrap["employees"][number] | null
  >(null);
  const [removeError, setRemoveError] = useState("");
  const [assign, setAssign] = useState({
    project_id: jobId ?? "",
    employee_ids: [] as string[],
    date: "",
    start_time: "07:00",
    end_time: "15:30",
    notes: "",
  });
  const [review, setReview] = useState<{
    submission: PortalSubmission;
    decision: "approved" | "rejected" | "reopen";
  } | null>(null);
  const [comment, setComment] = useState("");
  const [editingAssignment, setEditingAssignment] =
    useState<PortalAssignment | null>(null);
  const removeCancelRef = useRef<HTMLButtonElement | null>(null);
  const isSettings = location === "/team/permissions";
  const isAssignment = location === "/team/assignments";
  const isReviews =
    location === "/team/timesheets" || activePanel === "timesheets";
  const isUpdates = activePanel === "updates";
  const isJobStaff = !!jobId && activePanel === "staff";
  const activeJob = q.data?.jobs.find((j) => j.id === jobId);
  const title = isSettings
    ? "Permissions"
    : isAssignment
      ? "Assignments"
      : isReviews
        ? "Timesheets"
        : isUpdates
          ? (activeJob?.name ?? "Job updates")
          : jobId
            ? `${activeJob?.name ?? "Job"} · Team`
            : "Team";

  async function action(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await portalRequest(path, body, method);
      await refresh();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action("/team/employees", {
      name: staff.name.trim(),
      email: staff.email.trim(),
      role: staff.role,
      ...(isAdmin
        ? { hourly_rate: staff.hourly_rate ? Number(staff.hourly_rate) : null }
        : {}),
    });
    if (ok) {
      setStaff({ name: "", email: "", role: "labourer", hourly_rate: "" });
      setAddOpen(false);
      setMessage(
        "Team member profile created. Send an invitation from their Actions menu when ready.",
      );
    }
  }
  async function saveStaff(
    id: string,
    form: HTMLFormElement,
    previousEmail: string,
  ) {
    const fd = new FormData(form);
    const email = String(fd.get("email")).trim();
    const emailChanged =
      email.toLowerCase() !== previousEmail.trim().toLowerCase();
    const ok = await action(
      `/team/employees/${id}`,
      {
        name: String(fd.get("name")),
        email,
        role: String(fd.get("role")),
        active: fd.get("active") === "on",
        ...(isAdmin && showRates
          ? {
              hourly_rate: fd.get("hourly_rate")
                ? Number(fd.get("hourly_rate"))
                : null,
            }
          : {}),
      },
      "PATCH",
    );
    if (ok) {
      setEditing(null);
      if (emailChanged)
        setInvitedIds((previous) => {
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
      setMessage(
        emailChanged
          ? "Team member profile updated. A fresh invitation is required for the new email address."
          : "Team member profile updated.",
      );
    }
  }
  async function invite(id: string) {
    const ok = await action(`/team/employees/${id}/invite`, {});
    if (ok) {
      setInvitedIds((previous) => new Set(previous).add(id));
      setMessage(
        "Invitation sent. The team member will receive an expiring link by email.",
      );
    }
  }
  async function removeStaff() {
    if (!removeTarget) return;
    setBusy(true);
    setRemoveError("");
    setError("");
    setMessage("");
    try {
      await portalRequest(
        `/team/employees/${removeTarget.id}`,
        undefined,
        "DELETE",
      );
      await refresh();
      setRemoveTarget(null);
      setMessage(
        `${removeTarget.name} was removed from the team. Their work history has been retained.`,
      );
    } catch (e) {
      setRemoveError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function assignCrew(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!assign.project_id || !assign.employee_ids.length || !assign.date)
        throw new Error("Choose a job, one or more team members and a date.");
      const tz = team?.timezone || "Australia/Sydney";
      const startUtc = localDateTimeToUtc(
        `${assign.date}T${assign.start_time}`,
        tz,
      );
      const endUtc = localDateTimeToUtc(
        `${assign.date}T${assign.end_time}`,
        tz,
      );
      if (Date.parse(endUtc) <= Date.parse(startUtc))
        throw new Error("Finish time must be after start time.");
      await portalRequest("/team/assignments", {
        project_id: assign.project_id,
        employee_ids: assign.employee_ids,
        date: assign.date,
        start_time: assign.start_time,
        end_time: assign.end_time,
        notes: assign.notes || undefined,
      });
      await refresh();
      setMessage("Team assignment saved.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function updateAssignment(
    id: string,
    payload: {
      date: string;
      start_time: string;
      end_time: string;
      notes?: string;
    },
  ) {
    const ok = await action(`/team/assignments/${id}`, payload, "PATCH");
    if (ok) {
      setEditingAssignment(null);
      setMessage("Shared appointment updated for everyone assigned.");
    }
    return ok;
  }
  async function decide(e: React.FormEvent) {
    e.preventDefault();
    if (!review) return;
    if (review.decision !== "approved" && !comment.trim()) {
      setError("Add a comment before denying or reopening this week.");
      return;
    }
    const ok = await action("/team/review", {
      submission_id: review.submission.id,
      decision: review.decision,
      comment: comment.trim(),
    });
    if (ok) {
      setReview(null);
      setComment("");
      setMessage(
        review.decision === "approved"
          ? "Timesheet approved."
          : review.decision === "rejected"
            ? "Timesheet denied. The employee or an admin can correct and resubmit."
            : "Week reopened. Make corrections, then use Submit for review or ask the employee to resubmit before approval.",
      );
    }
  }
  function openReview(
    submission: PortalSubmission,
    decision: "approved" | "rejected" | "reopen",
  ) {
    setError("");
    setComment("");
    setReview({ submission, decision });
  }
  async function savePermission(
    role: EmployeeRole,
    permissions: OperationalPermissions,
  ) {
    await action("/team/permissions", { role, permissions });
  }
  const team = q.data;
  const isArchived = (employee: TeamBootstrap["employees"][number]) =>
    Boolean(
      (
        employee as TeamBootstrap["employees"][number] & {
          archived_at?: string | null;
        }
      ).archived_at,
    );
  const visibleEmployees =
    team?.employees.filter((employee) => !isArchived(employee)) ?? [];
  const isTeamIndex = !embedded && !jobId && location === "/team";
  const employeeStatus = (employee: TeamBootstrap["employees"][number]) =>
    !employee.active
      ? "Inactive"
      : employee.auth_user_id
        ? "Active"
        : invitedIds.has(employee.id)
          ? "Invited"
          : "Invite status unknown";
  return (
    <AlertDialog
      open={!!removeTarget}
      onOpenChange={(open) => {
        if (!open && !busy) setRemoveTarget(null);
      }}
    >
      <PageLayout
        title={title}
        description={
          isSettings
            ? "Control operational information available to each role."
            : isAssignment
              ? "Schedule team members on existing jobs."
              : isReviews
                ? "Review recorded hours and approved pay estimates for the selected week."
                : isUpdates
                  ? "Private operational notes and field photos for this job."
                  : jobId
                    ? "Manage team assignments and time records for this job."
                    : "Team member access, invitations and private hourly pay settings."
        }
        className={`team-page ${embedded ? "!py-0" : ""}`}
        actions={
          isTeamIndex ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/team/assignments" className={outline}>
                <CalendarDays className="h-4 w-4" />
                Schedule team
              </Link>
              <Button
                type="button"
                className={primary}
                onClick={() => {
                  setError("");
                  setStaff({
                    name: "",
                    email: "",
                    role: "labourer",
                    hourly_rate: "",
                  });
                  setAddOpen(true);
                }}
                data-testid="button-add-team-member"
              >
                <UserPlus className="h-4 w-4" />
                Add team member
              </Button>
            </div>
          ) : undefined
        }
      >
        {!embedded && !jobId && (
          <nav
            aria-label="Team sections"
            className="mb-6 grid grid-cols-2 gap-1 border-b border-border sm:flex"
          >
            {[
              ["/team", "Team"],
              ["/team/assignments", "Assignments"],
              ["/team/timesheets", "Timesheets"],
              ["/team/permissions", "Permissions"],
            ].map(([href, label]) => (
              <Link
                key={href}
                to={href}
                aria-current={location === href ? "page" : undefined}
                className={`flex min-h-11 min-w-0 items-center justify-center border-b-2 px-2 py-2.5 text-center text-sm font-semibold transition-colors sm:shrink-0 sm:px-3 ${location === href ? "border-amber-600 text-zinc-950" : "border-transparent text-zinc-700 hover:text-zinc-950"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        {q.isLoading ? (
          <TeamLoad retry={() => q.refetch()} />
        ) : q.error ? (
          <TeamLoad error={q.error} retry={() => q.refetch()} />
        ) : (
          team && (
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
              {isSettings ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {(["labourer", "supervisor", "admin"] as EmployeeRole[]).map(
                    (role) => (
                      <PermissionCard
                        key={role}
                        role={role}
                        initial={
                          team.permissions?.[role] ?? defaultPermissions[role]
                        }
                        save={savePermission}
                      />
                    ),
                  )}
                </div>
              ) : isAssignment ? (
                <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
                  <form className={`${card} p-5`} onSubmit={assignCrew}>
                    <h2 className="text-lg font-bold">
                      Assign team members to a job
                    </h2>
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="assign-job">Existing job</Label>
                        <select
                          id="assign-job"
                          className={`${field} mt-1.5`}
                          value={assign.project_id}
                          onChange={(e) =>
                            setAssign((s) => ({
                              ...s,
                              project_id: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select job</option>
                          {team.jobs.map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <fieldset>
                        <legend className="mb-2 text-sm font-medium">
                          Team members
                        </legend>
                        <div className="max-h-48 space-y-1 overflow-auto rounded-xl border border-[#e5e9e5] p-2">
                          {team.employees
                            .filter((e) => e.active && !isArchived(e))
                            .map((e) => (
                              <label
                                key={e.id}
                                className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-amber-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={assign.employee_ids.includes(e.id)}
                                  onChange={(ev) =>
                                    setAssign((s) => ({
                                      ...s,
                                      employee_ids: ev.target.checked
                                        ? [...s.employee_ids, e.id]
                                        : s.employee_ids.filter(
                                            (id) => id !== e.id,
                                          ),
                                    }))
                                  }
                                />
                                <span className="text-sm">
                                  {e.name}
                                  <small className="ml-2 text-zinc-700">
                                    {roleLabelsLocal(e.role)}
                                  </small>
                                </span>
                              </label>
                            ))}
                        </div>
                      </fieldset>
                      <div>
                        <Label htmlFor="assign-date">Date</Label>
                        <Input
                          id="assign-date"
                          type="date"
                          className={`${field} mt-1.5`}
                          value={assign.date}
                          onChange={(e) =>
                            setAssign((s) => ({ ...s, date: e.target.value }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="assign-start">Start</Label>
                          <Input
                            id="assign-start"
                            type="time"
                            className={`${field} mt-1.5`}
                            value={assign.start_time}
                            onChange={(e) =>
                              setAssign((s) => ({
                                ...s,
                                start_time: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="assign-end">Finish</Label>
                          <Input
                            id="assign-end"
                            type="time"
                            className={`${field} mt-1.5`}
                            value={assign.end_time}
                            onChange={(e) =>
                              setAssign((s) => ({
                                ...s,
                                end_time: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="assign-notes">Assignment notes</Label>
                        <Textarea
                          id="assign-notes"
                          className="mt-1.5"
                          value={assign.notes}
                          onChange={(e) =>
                            setAssign((s) => ({ ...s, notes: e.target.value }))
                          }
                          placeholder="Meet at the rear gate…"
                        />
                      </div>
                      <Button className={`${primary} w-full`} disabled={busy}>
                        {busy ? "Saving…" : "Assign team members"}
                      </Button>
                    </div>
                  </form>
                  <AssignmentList
                    team={team}
                    remove={(id) =>
                      action(`/team/assignments/${id}`, undefined, "DELETE")
                    }
                    edit={(a) => {
                      setError("");
                      setEditingAssignment(a);
                    }}
                    filterJob={jobId}
                  />
                </div>
              ) : isReviews ? (
                <>
                  <ReviewPanel
                    team={team}
                    setReview={openReview}
                    reviewerId={session.data?.employee?.id}
                    canViewPay={!!session.data?.canManageTeam}
                    canEdit={!!session.data?.canManageTeam}
                    refresh={refresh}
                  />
                  <AuditTrail rows={team.audit} />
                </>
              ) : isUpdates ? (
                <UpdatesPanel team={team} jobId={jobId} />
              ) : isJobStaff ? (
                <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
                  <form className={`${card} p-5`} onSubmit={assignCrew}>
                    <h2 className="text-lg font-bold">
                      Assign team members to {activeJob?.name ?? "this job"}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-700">
                      Choose one or more team members and a site schedule.
                    </p>
                    <fieldset className="mt-4">
                      <legend className="mb-2 text-sm font-medium">
                        Team members
                      </legend>
                      <div className="max-h-56 space-y-1 overflow-auto rounded-xl border border-zinc-300 p-2">
                        {team.employees
                          .filter((e) => e.active && !isArchived(e))
                          .map((e) => (
                            <label
                              key={e.id}
                              className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-amber-50"
                            >
                              <input
                                type="checkbox"
                                checked={assign.employee_ids.includes(e.id)}
                                onChange={(ev) =>
                                  setAssign((s) => ({
                                    ...s,
                                    project_id: jobId,
                                    employee_ids: ev.target.checked
                                      ? [...s.employee_ids, e.id]
                                      : s.employee_ids.filter(
                                          (id) => id !== e.id,
                                        ),
                                  }))
                                }
                              />
                              <span className="text-sm">
                                {e.name}
                                <small className="ml-2 text-zinc-700">
                                  {roleLabelsLocal(e.role)}
                                </small>
                              </span>
                            </label>
                          ))}
                      </div>
                    </fieldset>
                    <div className="mt-4 space-y-3">
                      <div>
                        <Label htmlFor="job-assign-date">Date</Label>
                        <Input
                          id="job-assign-date"
                          type="date"
                          className={`${field} mt-1.5`}
                          value={assign.date}
                          onChange={(e) =>
                            setAssign((s) => ({
                              ...s,
                              date: e.target.value,
                              project_id: jobId ?? "",
                            }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="job-assign-start">Start</Label>
                          <Input
                            id="job-assign-start"
                            type="time"
                            className={`${field} mt-1.5`}
                            value={assign.start_time}
                            onChange={(e) =>
                              setAssign((s) => ({
                                ...s,
                                start_time: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="job-assign-end">Finish</Label>
                          <Input
                            id="job-assign-end"
                            type="time"
                            className={`${field} mt-1.5`}
                            value={assign.end_time}
                            onChange={(e) =>
                              setAssign((s) => ({
                                ...s,
                                end_time: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="job-assign-notes">
                          Assignment notes
                        </Label>
                        <Textarea
                          id="job-assign-notes"
                          className="mt-1.5"
                          value={assign.notes}
                          onChange={(e) =>
                            setAssign((s) => ({ ...s, notes: e.target.value }))
                          }
                        />
                      </div>
                      <Button className={`${primary} w-full`} disabled={busy}>
                        Save assignment
                      </Button>
                    </div>
                  </form>
                  <AssignmentList
                    team={team}
                    remove={(id) =>
                      action(`/team/assignments/${id}`, undefined, "DELETE")
                    }
                    edit={(a) => {
                      setError("");
                      setEditingAssignment(a);
                    }}
                    filterJob={jobId}
                  />
                </div>
              ) : (
                <section className={`${card} overflow-hidden`}>
                  <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div>
                      <h2 className="font-bold">Team members</h2>
                      <p className="mt-1 text-sm text-zinc-700">
                        {visibleEmployees.length} team members
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">
                        Accepted accounts show Active. Pending invite history is
                        not returned by the current team API.
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        type="button"
                        className={outline}
                        aria-label={
                          showRates ? "Hide hourly rates" : "Show hourly rates"
                        }
                        aria-pressed={showRates}
                        onClick={() => setShowRates((value) => !value)}
                        data-testid="toggle-team-rates"
                      >
                        {showRates ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        {showRates ? "Hide pay rates" : "Show pay rates"}
                      </Button>
                    )}
                  </div>
                  {visibleEmployees.length ? (
                    visibleEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        className="border-b border-border p-4 last:border-0 sm:px-5 sm:py-4"
                      >
                        {editing === emp.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveStaff(
                                emp.id,
                                e.currentTarget,
                                emp.email,
                              );
                            }}
                            className="grid gap-3 sm:grid-cols-2"
                          >
                            <div>
                              <Label htmlFor={`staff-edit-name-${emp.id}`}>
                                Name
                              </Label>
                              <Input
                                id={`staff-edit-name-${emp.id}`}
                                name="name"
                                autoComplete="off"
                                className={`${field} mt-1`}
                                defaultValue={emp.name}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`staff-edit-email-${emp.id}`}>
                                Email
                              </Label>
                              <Input
                                id={`staff-edit-email-${emp.id}`}
                                name="email"
                                type="email"
                                autoComplete="off"
                                className={`${field} mt-1`}
                                defaultValue={emp.email}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`staff-edit-role-${emp.id}`}>
                                Role
                              </Label>
                              <select
                                id={`staff-edit-role-${emp.id}`}
                                name="role"
                                className={`${field} mt-1`}
                                defaultValue={emp.role}
                              >
                                {(
                                  [
                                    "labourer",
                                    "supervisor",
                                    "admin",
                                  ] as EmployeeRole[]
                                ).map((r) => (
                                  <option key={r} value={r}>
                                    {roleLabelsLocal(r)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {isAdmin && showRates && (
                              <div>
                                <Label htmlFor={`staff-edit-rate-${emp.id}`}>
                                  Hourly rate
                                </Label>
                                <Input
                                  id={`staff-edit-rate-${emp.id}`}
                                  name="hourly_rate"
                                  type="number"
                                  min="0"
                                  step=".01"
                                  className={`${field} mt-1`}
                                  defaultValue={emp.hourly_rate ?? ""}
                                />
                                <p className="mt-1 text-sm leading-5 text-zinc-700">
                                  Private pay estimate and job labour rate.
                                  Visible to admins and this team member only.
                                </p>
                              </div>
                            )}
                            <label className="flex min-h-11 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="active"
                                defaultChecked={emp.active}
                              />{" "}
                              Active access
                            </label>
                            <div className="flex flex-wrap gap-2 sm:col-span-2">
                              <Button className={primary} disabled={busy}>
                                {busy ? "Saving…" : "Save changes"}
                              </Button>
                              <Button
                                type="button"
                                className={outline}
                                disabled={busy}
                                onClick={() => setEditing(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            <div
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#edf3ee] font-bold text-[#405b47]"
                              aria-hidden="true"
                            >
                              {emp.name
                                .split(" ")
                                .map((x) => x[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="break-words font-semibold">
                                  {emp.name}
                                </p>
                                <span
                                  className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-sm font-semibold ${employeeStatus(emp) === "Active" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : employeeStatus(emp) === "Invited" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-zinc-300 bg-zinc-100 text-zinc-800"}`}
                                >
                                  {employeeStatus(emp)}
                                </span>
                              </div>
                              <p className="mt-0.5 break-all text-sm text-zinc-700">
                                {emp.email}
                              </p>
                              <p className="mt-0.5 text-sm text-zinc-700">
                                {roleLabelsLocal(emp.role)}
                              </p>
                              {isAdmin && showRates && (
                                <p className="mt-1 text-sm font-medium text-zinc-900">
                                  Hourly rate:{" "}
                                  {emp.hourly_rate === null
                                    ? "Not set"
                                    : `$${emp.hourly_rate.toFixed(2)} / hour`}
                                </p>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-800 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 disabled:opacity-50"
                                  aria-label={`Actions for ${emp.name}`}
                                  data-testid={`team-member-actions-${emp.id}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                  className="min-h-11 gap-2"
                                  disabled={busy || !emp.active}
                                  onSelect={() => void invite(emp.id)}
                                >
                                  <Mail className="h-4 w-4" />
                                  {emp.auth_user_id || invitedIds.has(emp.id)
                                    ? "Resend invite"
                                    : "Invite"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="min-h-11 gap-2"
                                  disabled={busy}
                                  onSelect={() => setEditing(emp.id)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="min-h-11 gap-2 text-red-800 focus:text-red-900"
                                  disabled={busy}
                                  onSelect={() => {
                                    setRemoveError("");
                                    setRemoveTarget(emp);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <UserPlus className="mx-auto mb-3 h-9 w-9 text-amber-800" />
                      <p className="font-semibold">No team members yet</p>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-700">
                        Add a team member profile, then send their invitation
                        from the Actions menu.
                      </p>
                      <Button
                        type="button"
                        className={`${primary} mt-4`}
                        onClick={() => setAddOpen(true)}
                      >
                        <UserPlus className="h-4 w-4" />
                        Add team member
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </>
          )
        )}
        {review && (
          <ReviewDialog
            review={review}
            comment={comment}
            setComment={setComment}
            close={() => setReview(null)}
            submit={decide}
            busy={busy}
            error={error}
          />
        )}
        {editingAssignment && (
          <AssignmentEditDialog
            assignment={editingAssignment}
            timezone={team?.timezone ?? "Australia/Sydney"}
            busy={busy}
            serverError={error}
            close={() => setEditingAssignment(null)}
            save={updateAssignment}
          />
        )}
        {removeTarget && (
          <AlertDialogContent
            role="alertdialog"
            aria-labelledby="remove-staff-title"
            aria-describedby="remove-staff-description"
            className={`${card} w-full max-w-md p-5 sm:p-6`}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              removeCancelRef.current?.focus();
            }}
          >
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-red-800">
              Remove team access
            </p>
            <AlertDialogTitle
              id="remove-staff-title"
              className="mt-2 text-xl font-bold text-zinc-950"
            >
              Remove {removeTarget.name}?
            </AlertDialogTitle>
            <AlertDialogDescription
              id="remove-staff-description"
              className="mt-3 space-y-2 text-sm leading-5 text-zinc-800"
            >
              <span className="block">
                This removes their access to the team and archives their
                profile. Existing timesheets, job costs and audit history are
                retained.
              </span>
              <span className="block">
                Any running timer must be clocked out before removal. Removal
                cannot be used to clock out a shift.
              </span>
            </AlertDialogDescription>
            {removeError && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900"
              >
                {removeError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel
                ref={removeCancelRef}
                className={`${outline} mt-0 sm:mt-0`}
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  if (!busy) setRemoveTarget(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <Button
                type="button"
                className={`${btn} bg-red-700 text-white hover:bg-red-800`}
                disabled={busy}
                onClick={() => void removeStaff()}
              >
                {busy ? "Removing…" : "Remove team member"}
              </Button>
            </div>
          </AlertDialogContent>
        )}
      </PageLayout>
      <Sheet
        open={addOpen}
        onOpenChange={(open) => {
          if (!busy) setAddOpen(open);
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-[min(28rem,100vw)] max-w-none flex-col gap-0 overflow-y-auto border-l border-zinc-200 bg-white p-0 text-zinc-950"
        >
          <form onSubmit={createStaff} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b border-zinc-200 px-5 py-5 pr-14 text-left">
              <SheetTitle className="font-heading text-xl">
                Add team member
              </SheetTitle>
              <SheetDescription className="leading-5">
                Create the profile first. Sending an invitation is a separate
                action in the member’s Actions menu.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  name="name"
                  autoComplete="name"
                  className={`${field} mt-1.5`}
                  value={staff.name}
                  onChange={(e) =>
                    setStaff((s) => ({ ...s, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={`${field} mt-1.5`}
                  value={staff.email}
                  onChange={(e) =>
                    setStaff((s) => ({ ...s, email: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="staff-role">Role</Label>
                <select
                  id="staff-role"
                  name="role"
                  className={`${field} mt-1.5`}
                  value={staff.role}
                  onChange={(e) =>
                    setStaff((s) => ({
                      ...s,
                      role: e.target.value as EmployeeRole,
                    }))
                  }
                >
                  {(["labourer", "supervisor", "admin"] as EmployeeRole[]).map(
                    (r) => (
                      <option key={r} value={r}>
                        {roleLabelsLocal(r)}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {isAdmin && (
                <div>
                  <Label htmlFor="staff-rate">Hourly rate</Label>
                  <Input
                    id="staff-rate"
                    name="hourly_rate"
                    type="number"
                    min="0"
                    step=".01"
                    className={`${field} mt-1.5`}
                    value={staff.hourly_rate}
                    onChange={(e) =>
                      setStaff((s) => ({ ...s, hourly_rate: e.target.value }))
                    }
                    placeholder="$ per hour"
                  />
                  <p className="mt-1.5 text-sm leading-5 text-zinc-700">
                    Used for team member pay estimates and job labour cost.
                    Visible to admins and this team member only.
                  </p>
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-[#fff1ed] p-3 text-sm text-[#a34632]"
                >
                  {error}
                </p>
              )}
            </div>
            <SheetFooter className="mt-auto border-t border-zinc-200 p-5">
              <Button
                type="button"
                className={outline}
                disabled={busy}
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className={primary} disabled={busy}>
                {busy ? "Saving…" : "Save team member"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </AlertDialog>
  );
}
function roleLabelsLocal(r: EmployeeRole) {
  return r === "supervisor"
    ? "Leading Hand / Supervisor"
    : r === "admin"
      ? "Admin"
      : "Labourer";
}
function AssignmentList({
  team,
  remove,
  edit,
  filterJob,
}: {
  team: TeamBootstrap;
  remove: (id: string) => void;
  edit: (assignment: PortalAssignment) => void;
  filterJob?: string;
}) {
  return (
    <TeamAssignmentList
      team={team}
      remove={remove}
      edit={edit}
      filterJob={filterJob}
    />
  );
}
function AssignmentEditDialog({
  assignment,
  timezone,
  busy,
  serverError,
  close,
  save,
}: {
  assignment: PortalAssignment;
  timezone: string;
  busy: boolean;
  serverError: string;
  close: () => void;
  save: (
    id: string,
    payload: {
      date: string;
      start_time: string;
      end_time: string;
      notes?: string;
    },
  ) => Promise<boolean>;
}) {
  const [date, setDate] = useState(assignment.date.slice(0, 10));
  const [start, setStart] = useState(assignment.start_time.slice(0, 5));
  const [end, setEnd] = useState(assignment.end_time.slice(0, 5));
  const [notes, setNotes] = useState(assignment.notes ?? "");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const startUtc = localDateTimeToUtc(`${date}T${start}`, timezone);
      const endUtc = localDateTimeToUtc(`${date}T${end}`, timezone);
      if (Date.parse(endUtc) <= Date.parse(startUtc))
        throw new Error("Finish time must be after start time.");
      await save(assignment.id, {
        date,
        start_time: start,
        end_time: end,
        notes,
      });
    } catch (err) {
      setError(errorText(err));
    }
  }
  const visibleError = error || serverError;
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/45 p-4"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && close()
      }
      onKeyDown={(event) => trapModalFocus(event, close, busy)}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-edit-title"
        className={`${card} w-full max-w-lg p-5 sm:p-6`}
        onSubmit={submit}
      >
        <p className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-700">
          Shared appointment
        </p>
        <h2 id="assignment-edit-title" className="mt-2 text-xl font-bold">
          Edit schedule
        </h2>
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-zinc-900">
          This updates the existing shared appointment. Every team member
          assigned to it will see the new date, time and notes.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="edit-assignment-date">Date</Label>
            <Input
              autoFocus
              id="edit-assignment-date"
              type="date"
              className={`${field} mt-1.5`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-assignment-start">Start time</Label>
              <Input
                id="edit-assignment-start"
                type="time"
                className={`${field} mt-1.5`}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-assignment-end">Finish time</Label>
              <Input
                id="edit-assignment-end"
                type="time"
                className={`${field} mt-1.5`}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-assignment-notes">Appointment notes</Label>
            <Textarea
              id="edit-assignment-notes"
              className="mt-1.5 min-h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {visibleError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-900"
            >
              {visibleError}
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className={outline}
            disabled={busy}
            onClick={close}
          >
            Cancel
          </Button>
          <Button className={primary} disabled={busy}>
            {busy ? "Saving…" : "Save shared schedule"}
          </Button>
        </div>
      </form>
    </div>
  );
}
function PermissionCard({
  role,
  initial,
  save,
}: {
  role: EmployeeRole;
  initial: OperationalPermissions;
  save: (r: EmployeeRole, p: OperationalPermissions) => void;
}) {
  const [permissions, setPermissions] = useState(initial);
  const labels: Record<keyof OperationalPermissions, string> = {
    view_scope: "View job scope",
    view_variations: "View approved variations",
    view_documents: "View published documents",
    add_photos: "Upload site photos",
    add_notes: "Write private job notes",
    review_timesheets: "Review timesheets",
  };
  return (
    <form
      className={`${card} p-5`}
      onSubmit={(e) => {
        e.preventDefault();
        save(role, permissions);
      }}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf3ee] text-[#45634d]">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <h2 className="font-bold">{roleLabelsLocal(role)}</h2>
      </div>
      <div className="mt-4 space-y-2">
        {permissionNames.map((key) => (
          <label
            key={key}
            className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-[#f7f9f7]"
          >
            <input
              type="checkbox"
              checked={permissions[key]}
              onChange={(e) =>
                setPermissions((p) => ({ ...p, [key]: e.target.checked }))
              }
            />
            <span className="text-sm">{labels[key]}</span>
          </label>
        ))}
      </div>
      <Button className={`${primary} mt-4 w-full`}>
        <Save className="h-4 w-4" />
        Save role
      </Button>
    </form>
  );
}
function ReviewPanel({
  team,
  setReview,
  reviewerId,
  canViewPay = false,
  canEdit = false,
  refresh,
}: {
  team: TeamBootstrap;
  setReview: (
    submission: PortalSubmission,
    decision: "approved" | "rejected" | "reopen",
  ) => void;
  reviewerId?: string;
  canViewPay?: boolean;
  canEdit?: boolean;
  refresh: () => unknown;
}) {
  const [selectedWeek, setSelectedWeek] = useState(() =>
    weekStart(localDate(new Date(), team.timezone)),
  );
  const [editingEntry, setEditingEntry] = useState<PortalTimeEntry | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<PortalTimeEntry | null>(
    null,
  );
  const [deleteReason, setDeleteReason] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [mutationMessage, setMutationMessage] = useState("");
  const [mutationBusy, setMutationBusy] = useState(false);
  const [submitBusyId, setSubmitBusyId] = useState<string | null>(null);
  const actionFocusRef = useRef<HTMLButtonElement | null>(null);
  const entries = team.entries.filter(
    (entry) => weekStart(entry.work_date) === selectedWeek,
  );
  const submissions = team.submissions.filter(
    (s) =>
      s.week_start === selectedWeek &&
      ["submitted", "approved", "rejected"].includes(s.status) &&
      s.employee_id !== reviewerId,
  );
  const employeeIds = [
    ...new Set([
      ...entries.map((entry) => entry.employee_id),
      ...submissions.map((s) => s.employee_id),
    ]),
  ];
  function moveWeek(amount: number) {
    const date = new Date(`${selectedWeek}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount * 7);
    setSelectedWeek(weekStart(date.toISOString().slice(0, 10)));
  }
  function closeEditor() {
    if (mutationBusy) return;
    setEditingEntry(null);
    window.setTimeout(() => actionFocusRef.current?.focus(), 0);
  }
  function closeDelete() {
    if (mutationBusy) return;
    setDeleteTarget(null);
    window.setTimeout(() => actionFocusRef.current?.focus(), 0);
  }
  async function saveEntry(
    entry: PortalTimeEntry,
    payload: {
      project_id: string;
      started_at: string;
      ended_at: string;
      break_minutes: number;
      notes: string;
      reason?: string;
    },
  ) {
    setMutationBusy(true);
    setMutationError("");
    setMutationMessage("");
    try {
      await portalRequest(`/team/time/${entry.id}`, payload, "PATCH");
      setEditingEntry(null);
      await refresh();
      setMutationMessage(
        "Draft time entry corrected. The change is recorded in the audit trail.",
      );
      window.setTimeout(() => actionFocusRef.current?.focus(), 0);
    } catch (error) {
      setMutationError(errorText(error));
    } finally {
      setMutationBusy(false);
    }
  }
  async function deleteEntry() {
    if (!deleteTarget) return;
    setMutationBusy(true);
    setMutationError("");
    setMutationMessage("");
    try {
      await portalRequest(
        `/team/time/${deleteTarget.id}`,
        { reason: deleteReason.trim() || undefined },
        "DELETE",
      );
      setDeleteTarget(null);
      setDeleteReason("");
      await refresh();
      setMutationMessage(
        "Draft time entry deleted. The change is recorded in the audit trail.",
      );
      window.setTimeout(
        () => document.getElementById("review-weekly-title")?.focus(),
        0,
      );
    } catch (error) {
      setMutationError(errorText(error));
    } finally {
      setMutationBusy(false);
    }
  }
  async function submitForReview(employeeEntries: PortalTimeEntry[]) {
    const running = employeeEntries.some((entry) => !entry.ended_at);
    if (running) {
      setMutationError(
        "Clock out all running entries before submitting this week.",
      );
      return;
    }
    const representative = employeeEntries.find(
      (entry) => entry.status === "draft" && entry.ended_at,
    );
    if (!representative) return;
    setSubmitBusyId(representative.employee_id);
    setMutationError("");
    setMutationMessage("");
    try {
      await portalRequest(`/team/time/${representative.id}/submit`, {}, "POST");
      await refresh();
      setMutationMessage(
        `${employeeName(team, representative.employee_id)}’s week was submitted for review.`,
      );
    } catch (error) {
      setMutationError(errorText(error));
    } finally {
      setSubmitBusyId(null);
    }
  }
  return (
    <>
      <section className={`${card} overflow-hidden`}>
        <div className="border-b border-[#edf0ed] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="review-weekly-title" tabIndex={-1} className="font-bold">
                Weekly time review
              </h2>
              <p className="mt-1 text-sm text-[#77837a]">
                Review every recorded entry for this week, including drafts.
              </p>
            </div>
            <div className="flex min-h-11 flex-wrap items-center gap-2">
              <Button
                type="button"
                className={`${outline} !min-h-11 !px-3`}
                aria-label="Previous week"
                onClick={() => moveWeek(-1)}
              >
                Previous
              </Button>
              <label className="sr-only" htmlFor="review-week">
                Select week
              </label>
              <input
                id="review-week"
                type="date"
                className={`${field} !min-h-11 !w-auto min-w-[135px] flex-1`}
                value={selectedWeek}
                onChange={(event) => {
                  if (event.target.value)
                    setSelectedWeek(weekStart(event.target.value));
                }}
                aria-label="Week starting date"
              />
              <Button
                type="button"
                className={`${outline} !min-h-11 !px-3`}
                aria-label="Next week"
                onClick={() => moveWeek(1)}
              >
                Next
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#77837a]">
            Week starting {showDate(selectedWeek)} · pay estimates are visible
            to admins only.
          </p>
        </div>
        {mutationMessage && (
          <p
            role="status"
            className="border-b border-[#edf0ed] bg-[#edf5ee] px-4 py-3 text-sm text-[#3f6248]"
          >
            {mutationMessage}
          </p>
        )}
        {mutationError && (
          <p
            role="alert"
            className="border-b border-[#edf0ed] bg-[#fff1ed] px-4 py-3 text-sm text-[#a34632]"
          >
            {mutationError}
          </p>
        )}
        <div className="border-b border-[#edf0ed] bg-[#fbfcfb] p-4 sm:p-5">
          <TimesheetSummary entries={entries} showPay={canViewPay} />
        </div>
        {employeeIds.length ? (
          employeeIds.map((employeeId) => {
            const employee = team.employees.find((e) => e.id === employeeId);
            const employeeEntries = entries.filter(
              (e) => e.employee_id === employeeId,
            );
            const submission = submissions.find(
              (s) => s.employee_id === employeeId,
            );
            const lockedWeek =
              submission?.status === "submitted" ||
              submission?.status === "approved" ||
              employeeEntries.some(
                (entry) =>
                  entry.status === "submitted" || entry.status === "approved",
              );
            const hasClosedDraft = employeeEntries.some(
              (entry) => entry.status === "draft" && !!entry.ended_at,
            );
            const hasRunningClock = employeeEntries.some(
              (entry) => !entry.ended_at,
            );
            return (
              <article
                key={employeeId}
                className="border-b border-[#edf0ed] p-4 last:border-0 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <b>{employee?.name ?? "Team member"}</b>
                    <p className="mt-1 text-xs text-[#77837a]">
                      {employeeEntries.length} recorded{" "}
                      {employeeEntries.length === 1 ? "entry" : "entries"} ·
                      week of {showDate(selectedWeek)}
                    </p>
                    {submission && (
                      <span
                        className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${submission.status === "approved" ? "bg-[#edf5ee] text-[#44654a]" : submission.status === "submitted" ? "bg-[#fff3df] text-[#96652a]" : "bg-[#f2f5f2] text-[#627067]"}`}
                      >
                        {submission.status} submission
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {submission?.status === "submitted" ? (
                      <>
                        <Button
                          className={outline}
                          onClick={() => setReview(submission, "reopen")}
                        >
                          Reopen week
                        </Button>
                        <Button
                          className={outline}
                          onClick={() => setReview(submission, "rejected")}
                        >
                          Deny week
                        </Button>
                        <Button
                          className={primary}
                          onClick={() => setReview(submission, "approved")}
                        >
                          <Check className="h-4 w-4" />
                          Approve week
                        </Button>
                      </>
                    ) : submission?.status === "approved" ? (
                      <Button
                        className={outline}
                        onClick={() => setReview(submission, "reopen")}
                      >
                        Reopen week
                      </Button>
                    ) : submission?.status === "rejected" ? (
                      <Button
                        className={outline}
                        onClick={() => setReview(submission, "reopen")}
                      >
                        Reopen for edits
                      </Button>
                    ) : null}
                    {canEdit && !lockedWeek && hasClosedDraft && (
                      <Button
                        type="button"
                        className={primary}
                        disabled={!!submitBusyId || hasRunningClock}
                        onClick={() => void submitForReview(employeeEntries)}
                      >
                        {submitBusyId === employeeId
                          ? "Submitting…"
                          : "Submit for review"}
                      </Button>
                    )}
                  </div>
                  {canEdit && !lockedWeek && hasRunningClock && (
                    <p className="basis-full text-xs text-[#8a633f]">
                      Clock out all running entries before submitting this week.
                    </p>
                  )}
                </div>
                <div className="mt-3">
                  <TimesheetSummary
                    entries={employeeEntries}
                    hourlyRate={employee?.hourly_rate}
                    showRate={canViewPay}
                    showPay={canViewPay}
                    compact
                  />
                </div>
                {employeeEntries.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {employeeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl bg-[#f6f8f6] p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b>
                            {team.jobs.find((j) => j.id === entry.project_id)
                              ?.name ?? "Job"}
                          </b>
                          <span className="rounded-full bg-white px-2 py-1 font-semibold capitalize text-[#627067]">
                            {entry.status}
                          </span>
                        </div>
                        <span className="mt-1 block text-[#758178]">
                          {showDate(entry.work_date)} ·{" "}
                          {showTime(entry.started_at, team.timezone)}–
                          {showTime(entry.ended_at, team.timezone)} ·{" "}
                          {entry.break_minutes}m unpaid break
                          {!entry.ended_at ? " · running clock excluded" : ""}
                        </span>
                        {entry.notes && (
                          <span className="mt-1 block text-[#69766c]">
                            {entry.notes}
                          </span>
                        )}
                        {entry.status !== "draft" || lockedWeek ? (
                          <p className="mt-2 text-xs text-[#7b6a50]">
                            This week is locked. Reopen the whole week before
                            correcting or deleting entries.
                          </p>
                        ) : !entry.ended_at ? (
                          <p className="mt-2 text-xs text-[#8a633f]">
                            Running clock · clock out before editing or
                            deleting.
                          </p>
                        ) : (
                          canEdit && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                className={`${outline} !min-h-11 !px-3`}
                                disabled={mutationBusy}
                                onClick={(event) => {
                                  actionFocusRef.current = event.currentTarget;
                                  setMutationError("");
                                  setMutationMessage("");
                                  setEditingEntry(entry);
                                }}
                              >
                                Edit entry
                              </Button>
                              <Button
                                type="button"
                                className={`${btn} !min-h-11 !px-3 border border-[#e7c9bf] bg-[#fff8f5] text-[#a34632] hover:bg-[#fff0eb]`}
                                disabled={mutationBusy}
                                onClick={(event) => {
                                  actionFocusRef.current = event.currentTarget;
                                  setMutationError("");
                                  setMutationMessage("");
                                  setDeleteReason("");
                                  setDeleteTarget(entry);
                                }}
                              >
                                Delete entry
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {submission?.review_comment && (
                  <p className="mt-3 text-sm text-[#77837a]">
                    Review note: {submission.review_comment}
                  </p>
                )}
              </article>
            );
          })
        ) : (
          <div className="p-10 text-center">
            <ClipboardCheck className="mx-auto h-8 w-8 text-[#8b998f]" />
            <p className="mt-3 font-semibold">No time recorded this week</p>
            <p className="mt-1 text-sm text-[#78847b]">
              Choose another week or check back after hours are logged.
            </p>
          </div>
        )}
      </section>
      {editingEntry && (
        <TimeEntryEditor
          entry={editingEntry}
          team={team}
          busy={mutationBusy}
          error={mutationError}
          close={closeEditor}
          save={(payload) => saveEntry(editingEntry, payload)}
        />
      )}
      {deleteTarget && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-[#1d2a21]/45 p-4"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeDelete()
          }
          onKeyDown={(event) =>
            trapModalFocus(event, closeDelete, mutationBusy)
          }
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="team-delete-title"
            aria-describedby="team-delete-description"
            className={`${card} max-h-[90dvh] w-full max-w-md overflow-y-auto p-5 sm:p-6`}
          >
            <h2 id="team-delete-title" className="text-xl font-bold">
              Delete draft time entry?
            </h2>
            <p
              id="team-delete-description"
              className="mt-2 text-sm leading-5 text-[#718076]"
            >
              This removes {employeeName(team, deleteTarget.employee_id)}’s{" "}
              {showDate(deleteTarget.work_date)} entry. The action will be
              recorded in the audit trail.
            </p>
            {mutationError && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-[#fff1ed] p-3 text-sm text-[#a34632]"
              >
                {mutationError}
              </p>
            )}
            <Label htmlFor="delete-entry-reason" className="mt-4 block">
              Correction reason (optional)
            </Label>
            <Textarea
              id="delete-entry-reason"
              className="mt-1.5 min-h-20"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Add context for the audit trail."
            />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                autoFocus
                className={outline}
                disabled={mutationBusy}
                onClick={closeDelete}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={`${btn} border border-[#e7c9bf] bg-[#a34632] text-white hover:bg-[#8f3c2d]`}
                disabled={mutationBusy}
                onClick={() => void deleteEntry()}
              >
                {mutationBusy ? "Deleting…" : "Delete entry"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function employeeName(team: TeamBootstrap, employeeId: string) {
  return (
    team.employees.find((employee) => employee.id === employeeId)?.name ??
    "this team member"
  );
}
function datetimeForTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
function TimeEntryEditor({
  entry,
  team,
  busy,
  error,
  close,
  save,
}: {
  entry: PortalTimeEntry;
  team: TeamBootstrap;
  busy: boolean;
  error: string;
  close: () => void;
  save: (payload: {
    project_id: string;
    started_at: string;
    ended_at: string;
    break_minutes: number;
    notes: string;
    reason?: string;
  }) => Promise<void>;
}) {
  const timezone = team.timezone || "Australia/Sydney";
  const [projectId, setProjectId] = useState(entry.project_id);
  const [start, setStart] = useState(() =>
    datetimeForTimezone(entry.started_at, timezone),
  );
  const [end, setEnd] = useState(() =>
    entry.ended_at ? datetimeForTimezone(entry.ended_at, timezone) : "",
  );
  const [breakMins, setBreakMins] = useState(String(entry.break_minutes));
  const [notes, setNotes] = useState(entry.notes);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const currentJob = team.jobs.find((job) => job.id === entry.project_id);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    try {
      if (!projectId) throw new Error("Choose a job.");
      const started_at = localDateTimeToUtc(start, timezone);
      const ended_at = localDateTimeToUtc(end, timezone);
      paidMinutes(started_at, ended_at, Number(breakMins));
      await save({
        project_id: projectId,
        started_at,
        ended_at,
        break_minutes: Number(breakMins),
        notes,
        reason: reason.trim() || undefined,
      });
    } catch (problem) {
      setFormError(errorText(problem));
    }
  }
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 grid place-items-center bg-[#1d2a21]/45 p-3 sm:p-4"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && close()
      }
      onKeyDown={(event) => trapModalFocus(event, close, busy)}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-entry-edit-title"
        className={`${card} max-h-[92dvh] w-full max-w-xl overflow-y-auto p-5 sm:p-6`}
        onSubmit={submit}
      >
        <p className="text-sm font-semibold uppercase tracking-[.12em] text-zinc-700">
          Draft correction
        </p>
        <h2 id="team-entry-edit-title" className="mt-2 text-xl font-bold">
          Edit time entry
        </h2>
        <p className="mt-2 rounded-xl bg-[#fff7e8] p-3 text-sm leading-5 text-[#795f35]">
          Only drafts can be edited. Submitted or approved weeks must be
          reopened first. This change is recorded in the audit trail.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="team-entry-job">Job</Label>
            <select
              id="team-entry-job"
              className={`${field} mt-1.5`}
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              required
            >
              <option value="">Choose job</option>
              {!team.jobs.some((job) => job.id === entry.project_id) && (
                <option value={entry.project_id}>
                  {currentJob?.name ?? "Historical job (unchanged)"}
                </option>
              )}
              {team.jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-zinc-700">
              Historical job assignment is retained unless you select another
              job.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="team-entry-start">Start · {timezone}</Label>
              <Input
                autoFocus
                id="team-entry-start"
                type="datetime-local"
                className={`${field} mt-1.5`}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="team-entry-end">Finish · {timezone}</Label>
              <Input
                id="team-entry-end"
                type="datetime-local"
                className={`${field} mt-1.5`}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="team-entry-break">Unpaid break · minutes</Label>
            <Input
              id="team-entry-break"
              type="number"
              min="0"
              step="1"
              className={`${field} mt-1.5`}
              value={breakMins}
              onChange={(event) => setBreakMins(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="team-entry-notes">Work notes</Label>
            <Textarea
              id="team-entry-notes"
              className="mt-1.5 min-h-20"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="team-entry-reason">
              Correction reason (optional)
            </Label>
            <Textarea
              id="team-entry-reason"
              className="mt-1.5 min-h-16"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Add context for the audit trail."
            />
          </div>
          {(formError || error) && (
            <p
              role="alert"
              className="rounded-xl bg-[#fff1ed] p-3 text-sm text-[#a34632]"
            >
              {formError || error}
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className={outline}
            disabled={busy}
            onClick={close}
          >
            Cancel
          </Button>
          <Button className={primary} disabled={busy}>
            {busy ? "Saving…" : "Save correction"}
          </Button>
        </div>
      </form>
    </div>
  );
}
function AuditTrail({ rows }: { rows: TeamBootstrap["audit"] }) {
  return (
    <section className={`${card} mt-5 p-5`}>
      <h2 className="font-bold">Immutable review audit</h2>
      <p className="mt-1 text-sm text-[#77837a]">
        Recorded decisions and changes, newest first.
      </p>
      {rows.length ? (
        <ol className="mt-4 space-y-3">
          {[...rows].reverse().map((row) => (
            <li
              key={row.id}
              className="flex gap-3 border-t border-[#edf0ed] pt-3"
            >
              <span className="mt-1 h-2 w-2 rounded-full bg-[#56745e]" />
              <span className="min-w-0 flex-1">
                <b className="text-sm">{row.action.replace(/_/g, " ")}</b>
                <span className="mt-1 block text-xs text-[#7d8980]">
                  {showDate(row.created_at)} · actor {row.actor_id.slice(0, 8)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-[#78847b]">
          No review activity recorded yet.
        </p>
      )}
    </section>
  );
}
function ReviewDialog({
  review,
  comment,
  setComment,
  close,
  submit,
  busy,
  error,
}: {
  review: {
    submission: PortalSubmission;
    decision: "approved" | "rejected" | "reopen";
  };
  comment: string;
  setComment: (v: string) => void;
  close: () => void;
  submit: (e: React.FormEvent) => void;
  busy: boolean;
  error?: string;
}) {
  const required = review.decision !== "approved";
  const title =
    review.decision === "approved"
      ? "Approve timesheet"
      : review.decision === "rejected"
        ? "Deny timesheet"
        : "Reopen week for corrections";
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 grid place-items-center bg-[#1d2a21]/45 p-4"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && close()
      }
      onKeyDown={(event) => trapModalFocus(event, close, busy)}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        onSubmit={submit}
        className={`${card} max-h-[90dvh] w-full max-w-md overflow-y-auto p-5 sm:p-6`}
      >
        <h2 id="review-title" className="text-xl font-bold">
          {title}
        </h2>
        {review.decision === "reopen" ? (
          <p className="mt-2 rounded-xl bg-[#fff7e8] p-3 text-sm leading-5 text-[#795f35]">
            Reopening unlocks the whole week for corrections. If it was
            approved, its posted job labour cost is reversed. The employee or an
            admin must resubmit the corrected week before it can be approved and
            posted again.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#718076]">
            Week commencing {showDate(review.submission.week_start)}.{" "}
            {review.decision === "approved"
              ? "Approval confirms these hours for posting to job labour."
              : "Denying returns the week to the employee for corrections and resubmission."}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-[#fff1ed] p-3 text-sm text-[#a34632]"
          >
            {error}
          </p>
        )}
        <Label htmlFor="review-comment" className="mt-5 block">
          Review comment {required ? "(required)" : "(optional)"}
        </Label>
        <Textarea
          autoFocus
          id="review-comment"
          className="mt-1.5 min-h-24"
          required={required}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={
            review.decision === "reopen"
              ? "Explain why the week is being reopened…"
              : "Explain your decision…"
          }
        />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className={outline}
            disabled={busy}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            className={primary}
            disabled={busy || (required && !comment.trim())}
          >
            {busy
              ? "Saving…"
              : review.decision === "approved"
                ? "Approve week"
                : review.decision === "rejected"
                  ? "Deny and return"
                  : "Reopen week"}
          </Button>
        </div>
      </form>
    </div>
  );
}
function UpdatesPanel({
  team,
  jobId,
}: {
  team: TeamBootstrap;
  jobId?: string;
}) {
  const notes = team.notes.filter((n) => !jobId || n.project_id === jobId);
  const docs = team.documents.filter((d) => !jobId || d.project_id === jobId);
  const jobs = team.jobs;
  const refresh = useRefreshPortal();
  const [job, setJob] = useState(jobId ?? jobs[0]?.id ?? "");
  const [phone, setPhone] = useState(
    jobs.find((j) => j.id === job)?.client_phone ?? "",
  );
  const [notesText, setNotesText] = useState(
    jobs.find((j) => j.id === job)?.employee_notes ?? "",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await portalRequest(`/team/jobs/${job}`, {
        client_phone: phone,
        employee_notes: notesText,
      });
      await refresh();
      setMessage("Job details saved.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function visibility(id: string, employee_visible: boolean) {
    setError("");
    try {
      await portalRequest(`/team/documents/${id}/visibility`, {
        employee_visible,
      });
      await refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <form className={`${card} p-5`} onSubmit={saveDetails}>
          <h2 className="font-bold">Operational job details</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Team member notes are private to the team. Do not include commercial
            details.
          </p>
          <Label htmlFor="update-job" className="mt-4 block">
            Job
          </Label>
          <select
            id="update-job"
            className={`${field} mt-1.5`}
            value={job}
            onChange={(e) => {
              const j = jobs.find((x) => x.id === e.target.value);
              setJob(e.target.value);
              setPhone(j?.client_phone ?? "");
              setNotesText(j?.employee_notes ?? "");
            }}
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
          <Label htmlFor="job-phone" className="mt-3 block">
            Client site phone
          </Label>
          <Input
            id="job-phone"
            className={`${field} mt-1.5`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Label htmlFor="job-notes" className="mt-3 block">
            Team member notes
          </Label>
          <Textarea
            id="job-notes"
            className="mt-1.5 min-h-24"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-900">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="mt-3 text-sm text-zinc-800">
              {message}
            </p>
          )}
          <Button className={`${primary} mt-3 w-full`} disabled={busy}>
            Save job details
          </Button>
        </form>
        <section className={`${card} p-5`}>
          <h2 className="font-bold">Team updates</h2>
          {notes.length ? (
            notes.map((n) => (
              <div key={n.id} className="border-t border-border py-3">
                <p className="text-sm">{n.body}</p>
                <small className="text-sm text-zinc-700">
                  {showDate(n.created_at)}
                </small>
              </div>
            ))
          ) : (
            <p className="mt-3 text-sm text-zinc-700">
              No team member notes have been added.
            </p>
          )}
        </section>
      </div>
      <div className="space-y-4">
        <PhotoGallery documents={docs} />
        <section className={`${card} p-5`}>
          <h2 className="font-bold">Team-member document access</h2>
          <p className="mt-1 text-sm text-zinc-700">
            Publishing to team members is separate from client visibility. Check
            every file: it must not contain financial details.
          </p>
          {docs.length ? (
            docs
              .filter((d) => !(d.purpose || "").toLowerCase().includes("photo"))
              .map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 border-t border-border py-3 first:mt-4"
                >
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm">
                      {d.display_name || d.file_name}
                    </b>
                    <small className="text-sm text-zinc-700">{d.purpose}</small>
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={d.employee_visible}
                      onChange={(e) => {
                        if (
                          e.target.checked &&
                          !window.confirm(
                            "Publish this file to assigned team members? Confirm it contains no financial details.",
                          )
                        )
                          return;
                        void visibility(d.id, e.target.checked);
                      }}
                    />
                    Team-member visible
                  </label>
                </div>
              ))
          ) : (
            <p className="mt-4 text-sm text-zinc-700">
              No job documents. Publish a document from Documents section after
              checking its contents.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
