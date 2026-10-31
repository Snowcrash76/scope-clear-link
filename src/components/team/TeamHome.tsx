import { useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import {
  CalendarDays,
  Eye,
  EyeOff,
  Mail,
  MoreVertical,
  Pencil,
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

import { PageLayout } from "@/components/PageLayout";

import type {
  TeamBootstrap,
  EmployeeRole,
  OperationalPermissions,
  PortalAssignment,
  PortalSubmission,
} from "../../../shared/employeePortal";
import {
  defaultPermissions,
  localDateTimeToUtc,
} from "../../../shared/employeePortal";
import {
  card,
  btn,
  primary,
  outline,
  field,
  errorText,
  roleLabelsLocal,
} from "./portalShared";
import { TeamLoad } from "./TeamLoadView";
import { AssignmentList } from "./AssignmentListView";
import { AssignmentEditDialog } from "./AssignmentEditDialog";
import { PermissionCard } from "./PermissionCardView";
import { ReviewPanel } from "./ReviewPanel";
import { ReviewDialog } from "./ReviewDialog";
import { UpdatesPanel } from "./UpdatesPanelView";
import { TimesheetSkeleton } from "@/components/timesheets/TimesheetSkeleton";
import { JobHoursSummary } from "@/components/team/JobHoursSummary";

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
  const legacyJobTimesheets = !!jobId && routePanel === "timesheets";
  const location = useLocation().pathname;
  const filterJob = legacyJobTimesheets ? undefined : jobId;
  const path = `/team/bootstrap${filterJob ? `?job_id=${encodeURIComponent(filterJob)}` : ""}`;
  const q = usePortal<TeamBootstrap>(path, !legacyJobTimesheets);
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
  if (legacyJobTimesheets) {
    return <Navigate to={`/team/timesheets?job=${encodeURIComponent(jobId)}`} replace />;
  }
  return (
    <AlertDialog
      open={!!removeTarget}
      onOpenChange={(open) => {
        if (!open && !busy) setRemoveTarget(null);
      }}
    >
      <PageLayout
        title={title}
        eyebrow={isSettings ? "ACCESS & PERMISSIONS" : isReviews ? "TIME REVIEW" : isAssignment ? "FIELD OPERATIONS" : "PEOPLE"}
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
                className={`flex min-h-11 min-w-0 items-center justify-center border-b-2 px-2 py-2.5 text-center text-sm font-semibold transition-colors sm:shrink-0 sm:px-3 ${location === href ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        {q.isLoading ? (
          location === "/team/timesheets" || activePanel === "timesheets" ? (
            <TimesheetSkeleton manager />
          ) : (
            <TeamLoad retry={() => q.refetch()} />
          )
        ) : q.error ? (
          <TeamLoad error={q.error} retry={() => q.refetch()} />
        ) : (
          team && (
            <>
              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
                >
                  {error}
                </p>
              )}
              {message && (
                <p
                  role="status"
                  className="mb-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
                >
                  {message}
                </p>
              )}
              {isJobStaff && jobId && <Link to={`/schedule?job=${encodeURIComponent(jobId)}`} className="mb-4 inline-flex min-h-11 items-center text-sm font-semibold underline">Open this job in schedule</Link>}
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
                        <div className="max-h-48 space-y-1 overflow-auto rounded-xl border border-border p-2">
                          {team.employees
                            .filter((e) => e.active && !isArchived(e))
                            .map((e) => (
                              <label
                                key={e.id}
                                className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-accent/20"
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
                                  <small className="ml-2 text-muted-foreground">
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
                </>
              ) : isUpdates ? (
                <UpdatesPanel team={team} jobId={jobId} />
              ) : isJobStaff ? (
                <div className="space-y-5">
                  {isAdmin && <JobHoursSummary entries={team.entries} jobId={jobId} />}
                  <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
                  <form className={`${card} p-5`} onSubmit={assignCrew}>
                    <h2 className="text-lg font-bold">
                      Assign team members to {activeJob?.name ?? "this job"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose one or more team members and a site schedule.
                    </p>
                    <fieldset className="mt-4">
                      <legend className="mb-2 text-sm font-medium">
                        Team members
                      </legend>
                      <div className="max-h-56 space-y-1 overflow-auto rounded-xl border border-border p-2">
                        {team.employees
                          .filter((e) => e.active && !isArchived(e))
                          .map((e) => (
                            <label
                              key={e.id}
                              className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-accent/20"
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
                                <small className="ml-2 text-muted-foreground">
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
                </div>
              ) : (
                <section className={`${card} overflow-hidden`}>
                  <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div>
                      <h2 className="font-bold">Team members</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {visibleEmployees.length} team members
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
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
                                <p className="mt-1 text-sm leading-5 text-muted-foreground">
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
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted font-bold text-muted-foreground"
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
                                  className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-sm font-semibold ${employeeStatus(emp) === "Active" ? "border-success/25 bg-success/10 text-success" : employeeStatus(emp) === "Invited" ? "border-warning/25 bg-warning/10 text-warning" : "border-border bg-muted text-muted-foreground"}`}
                                >
                                  {employeeStatus(emp)}
                                </span>
                              </div>
                              <p className="mt-0.5 break-all text-sm text-muted-foreground">
                                {emp.email}
                              </p>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {roleLabelsLocal(emp.role)}
                              </p>
                              {isAdmin && showRates && (
                                <p className="mt-1 text-sm font-medium text-foreground">
                                  Hourly rate:{" "}
                                  {emp.hourly_rate === null
                                    ? "Not set"
                                    : `$${emp.hourly_rate.toFixed(2)} / hour`}
                                </p>
                              )}
                            </div>
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
                                  className="min-h-11 gap-2 text-destructive focus:text-destructive"
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
                      <UserPlus className="mx-auto mb-3 h-9 w-9 text-warning" />
                      <p className="font-semibold">No team members yet</p>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
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
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document
                .querySelector<HTMLButtonElement>(
                  `[data-testid="team-member-actions-${removeTarget.id}"]`,
                )
                ?.focus();
            }}
          >
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-destructive">
              Remove team access
            </p>
            <AlertDialogTitle
              id="remove-staff-title"
              className="mt-2 text-xl font-bold text-foreground"
            >
              Remove {removeTarget.name}?
            </AlertDialogTitle>
            <AlertDialogDescription
              id="remove-staff-description"
              className="mt-3 space-y-2 text-sm leading-5 text-foreground"
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
                className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
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
                className={`${btn} bg-destructive text-destructive-foreground hover:bg-destructive/90`}
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
          className="flex h-full w-[min(28rem,100vw)] max-w-none flex-col gap-0 overflow-y-auto border-l border-border bg-background p-0 text-foreground"
        >
          <form onSubmit={createStaff} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b border-border px-5 py-5 pr-14 text-left">
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
                  <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                    Used for team member pay estimates and job labour cost.
                    Visible to admins and this team member only.
                  </p>
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-muted p-3 text-sm text-muted-foreground"
                >
                  {error}
                </p>
              )}
            </div>
            <SheetFooter className="mt-auto border-t border-border p-5">
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
