import { useMemo, useRef, useState } from "react";
import { Check, ChevronRight, History, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { portalRequest } from "@/hooks/useEmployeePortal";
import type {
  TeamBootstrap,
  PortalSubmission,
  PortalTimeEntry,
} from "../../../shared/employeePortal";
import { localDate, weekStart } from "../../../shared/employeePortal";
import { timesheetTotals } from "../../../shared/timesheetTotals";
import {
  EmptyState,
  EntriesTable,
  EntryCard,
  LockNotice,
  SummaryStrip,
  TimesheetStatusBadge,
  WeekSwitcher,
  formatDay,
  formatDuration,
  formatHours,
  formatClock,
  sortReviewRows,
} from "@/components/timesheets";
import type { TimesheetStatus } from "@/components/timesheets";
import {
  primary,
  outline,
  card,
  errorText,
  trapModalFocus,
  employeeName,
  roleLabelsLocal,
  showDate,
} from "./portalShared";
import { TimeEntryEditor } from "./TimeEntryEditor";
import { TimesheetAuditHistory } from "@/components/project-manage/TimesheetAuditHistory";
import { InfoPopover } from "@/components/timesheets/InfoPopover";
import {
  auditActorName,
  auditLabel,
  formatAuditTimestamp,
  reviewAuditForPersonWeek,
  type AuditRow,
} from "@/components/project-manage/timesheetAudit";

type Filter = "All" | "Needs review" | "Approved" | "Drafts" | "Missing hours";
interface PersonWeek {
  id: string;
  name: string;
  role: string;
  employee: TeamBootstrap["employees"][number] | undefined;
  entries: PortalTimeEntry[];
  submission: PortalSubmission | undefined;
  status: TimesheetStatus;
  minutes: number;
  daily: number[];
  locked: boolean;
}

const paid = (entry: PortalTimeEntry) => timesheetTotals([entry]).paidMinutes;

export function ReviewPanel({
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
  const [filter, setFilter] = useState<Filter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<PortalTimeEntry | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<PortalTimeEntry | null>(
    null,
  );
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmApproveAll, setConfirmApproveAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [batchResult, setBatchResult] = useState("");
  const [auditDialog, setAuditDialog] = useState<{
    personId?: string;
    personName?: string;
    week?: string;
  } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const approveAllTriggerRef = useRef<HTMLButtonElement | null>(null);
  const entryActionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const auditTriggerRef = useRef<HTMLButtonElement | null>(null);
  const todayDate = localDate(new Date(), team.timezone);
  const today = weekStart(todayDate);
  const entries = useMemo(
    () =>
      team.entries.filter(
        (entry) => weekStart(entry.work_date) === selectedWeek,
      ),
    [team.entries, selectedWeek],
  );
  const allSubmissions = useMemo(
    () =>
      team.submissions.filter(
        (submission) =>
          submission.week_start === selectedWeek &&
          ["submitted", "approved", "rejected"].includes(submission.status),
      ),
    [team.submissions, selectedWeek],
  );
  const people = useMemo<PersonWeek[]>(() => {
    const ids = new Set([
      ...team.employees.filter((e) => e.active).map((e) => e.id),
      ...entries.map((entry) => entry.employee_id),
      ...allSubmissions.map((submission) => submission.employee_id),
    ]);
    const list = [...ids].map((id) => {
      const memberEntries = entries.filter((entry) => entry.employee_id === id);
      const submission = allSubmissions.find((item) => item.employee_id === id);
      const running = memberEntries.some((entry) => !entry.ended_at);
      const status: TimesheetStatus = running
        ? "running"
        : (submission?.status ?? "draft");
      const locked =
        submission?.status === "submitted" ||
        submission?.status === "approved" ||
        memberEntries.some(
          (entry) =>
            entry.status === "submitted" || entry.status === "approved",
        );
      const monday = new Date(`${selectedWeek}T12:00:00Z`);
      const daily = Array.from({ length: 7 }, (_, day) => {
        const date = new Date(monday);
        date.setUTCDate(date.getUTCDate() + day);
        const key = date.toISOString().slice(0, 10);
        return memberEntries
          .filter((entry) => entry.work_date === key)
          .reduce((sum, entry) => sum + paid(entry), 0);
      });
      return {
        id,
        name:
          team.employees.find((item) => item.id === id)?.name ?? "Team member",
        role: team.employees.find((item) => item.id === id)?.role ?? "labourer",
        employee: team.employees.find((item) => item.id === id),
        entries: memberEntries,
        submission,
        status,
        minutes: memberEntries.reduce((sum, entry) => sum + paid(entry), 0),
        daily,
        locked,
      };
    });
    return sortReviewRows(list);
  }, [team.employees, entries, allSubmissions, selectedWeek, reviewerId]);
  const selected = people.find((person) => person.id === selectedId) ?? null;
  const reviewerRole = team.employees.find(
    (employee) => employee.id === reviewerId,
  )?.role;
  const canReview =
    canEdit ||
    Boolean(reviewerRole && team.permissions[reviewerRole]?.review_timesheets);
  const filtered = people.filter((person) => {
    if (filter === "Needs review") return person.status === "submitted";
    if (filter === "Approved") return person.status === "approved";
    if (filter === "Drafts")
      return (
        person.status === "draft" ||
        person.status === "running" ||
        person.status === "rejected"
      );
    if (filter === "Missing hours") return person.minutes === 0;
    return true;
  });
  const counts: Record<Filter, number> = {
    All: people.length,
    "Needs review": people.filter((p) => p.status === "submitted").length,
    Approved: people.filter((p) => p.status === "approved").length,
    Drafts: people.filter((p) =>
      ["draft", "running", "rejected"].includes(p.status),
    ).length,
    "Missing hours": people.filter((p) => p.minutes === 0).length,
  };
  const submittedPeople = people.filter(
    (p) => p.submission?.status === "submitted" && p.id !== reviewerId,
  );
  const weekTotals = timesheetTotals(entries);
  const paidMinutes = weekTotals.paidMinutes;
  const awaiting = people.filter((p) => p.status === "submitted");
  const awaitingMinutes = weekTotals.submittedMinutes;
  const approvedMinutes = weekTotals.approvedMinutes;
  const estimatedPay = weekTotals.approvedPay;
  const runningCount = entries.filter((entry) => !entry.ended_at).length;
  const lastWeek = team.entries
    .filter(
      (entry) => entry.ended_at && weekStart(entry.work_date) !== selectedWeek,
    )
    .map((entry) => weekStart(entry.work_date))
    .sort()
    .at(-1);
  const showNoWeekData =
    entries.length === 0 &&
    allSubmissions.length === 0 &&
    filter !== "Missing hours";
  const selectedTotals = selected ? timesheetTotals(selected.entries) : null;
  const auditRows = team.audit as AuditRow[];
  const reviewEvents = (personId: string) =>
    reviewAuditForPersonWeek(auditRows, personId, selectedWeek).filter((row) =>
      ["week.approved", "week.rejected", "week.reopen"].includes(row.action),
    );
  const lastReviewedLine = (personId: string) => {
    const latest = reviewEvents(personId)[0];
    if (!latest) return "Not yet reviewed";
    const label = auditLabel(latest)?.label ?? "Reviewed";
    const timestamp = formatAuditTimestamp(latest.created_at, team.timezone);
    return `Last reviewed by ${auditActorName(latest, team.employees)} on ${timestamp.text} — ${label}`;
  };
  function openDrawer(person: PersonWeek, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setSelectedId(person.id);
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            '[data-testid="timesheet-review-drawer"] button',
          )
          ?.focus(),
      0,
    );
  }
  function closeDrawer() {
    setSelectedId(null);
    window.setTimeout(() => {
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      else document.getElementById("review-weekly-title")?.focus();
    }, 0);
  }
  function closeApproveAll() {
    if (busy) return;
    setConfirmApproveAll(false);
    window.setTimeout(() => {
      if (approveAllTriggerRef.current?.isConnected)
        approveAllTriggerRef.current.focus();
      else document.getElementById("review-weekly-title")?.focus();
    }, 0);
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
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await portalRequest(`/team/time/${entry.id}`, payload, "PATCH");
      setEditingEntry(null);
      await refresh();
      setMessage(
        "Draft time entry corrected. The change is recorded in the audit trail.",
      );
      window.setTimeout(() => entryActionTriggerRef.current?.focus(), 0);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function deleteEntry() {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      await portalRequest(
        `/team/time/${deleteTarget.id}`,
        { reason: deleteReason.trim() || undefined },
        "DELETE",
      );
      setDeleteTarget(null);
      setDeleteReason("");
      await refresh();
      setMessage(
        "Draft time entry deleted. The change is recorded in the audit trail.",
      );
      window.setTimeout(() => drawerCloseRef.current?.focus(), 0);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function submitForReview(person: PersonWeek) {
    if (person.entries.some((entry) => !entry.ended_at)) {
      setError("Clock out all running entries before submitting this week.");
      return;
    }
    const representative = person.entries.find(
      (entry) => entry.status === "draft" && entry.ended_at,
    );
    if (!representative) return;
    setBusy(true);
    setError("");
    try {
      await portalRequest(`/team/time/${representative.id}/submit`, {}, "POST");
      await refresh();
      setMessage(`${person.name}’s week was submitted for review.`);
      window.setTimeout(() => drawerCloseRef.current?.focus(), 0);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function approveAll() {
    setBusy(true);
    setBatchResult("");
    const results: string[] = [];
    for (const person of submittedPeople) {
      if (!person.submission) continue;
      try {
        await portalRequest("/team/review", {
          submission_id: person.submission.id,
          decision: "approved",
          comment: "",
        });
        results.push(`${person.name}: approved`);
      } catch (err) {
        results.push(`${person.name}: ${errorText(err)}`);
      }
    }
    await refresh();
    setBatchResult(results.join(" · "));
    setConfirmApproveAll(false);
    setBusy(false);
    window.setTimeout(() => {
      if (approveAllTriggerRef.current?.isConnected)
        approveAllTriggerRef.current.focus();
      else document.getElementById("review-weekly-title")?.focus();
    }, 0);
  }
  function closeDelete() {
    if (busy) return;
    setDeleteTarget(null);
    window.setTimeout(() => entryActionTriggerRef.current?.focus(), 0);
  }
  function closeEditor() {
    if (busy) return;
    setEditingEntry(null);
    window.setTimeout(() => entryActionTriggerRef.current?.focus(), 0);
  }
  const entryMenu = (entry: PortalTimeEntry) => {
    if (
      entry.status !== "draft" ||
      selected?.locked ||
      !entry.ended_at ||
      !canEdit
    )
      return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 p-0"
            aria-label="Entry actions"
            onClick={(event) => {
              entryActionTriggerRef.current = event.currentTarget;
            }}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="min-h-11"
            onSelect={() => setEditingEntry(entry)}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            onSelect={() => {
              setDeleteReason("");
              setError("");
              setDeleteTarget(entry);
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayIndex = (new Date(`${todayDate}T12:00:00Z`).getUTCDay() + 6) % 7;
  const dayIsToday = (index: number) =>
    selectedWeek === today && index === todayIndex;
  const renderPerson = (person: PersonWeek) => (
    <article
      key={person.id}
      data-testid={`timesheet-member-${person.id}`}
      className="border-b border-border bg-card p-4 last:border-0 hover:bg-muted/30 sm:p-5"
      role="group"
      tabIndex={0}
      onClick={(event) => openDrawer(person, event.currentTarget)}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          openDrawer(person, event.currentTarget);
        }
      }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent-foreground"
        >
          {person.name
            .split(/\s+/)
            .map((word) => word[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{person.name}</p>
          <p className="text-sm text-muted-foreground">
            {roleLabelsLocal(
              person.role as "labourer" | "supervisor" | "admin",
            )}
          </p>
        </div>
        <TimesheetStatusBadge status={person.status} />
      </div>
      <div
        className="mt-4 grid grid-cols-7 gap-1.5"
        aria-label={`${person.name} daily hours`}
      >
        {person.daily.map((minutes, index) => (
          <div
            key={index}
            className={`min-w-0 rounded-lg px-1 py-2 text-center ${dayIsToday(index) ? "bg-primary/20" : "bg-muted/60"}`}
          >
            <span className="block text-xs font-semibold text-muted-foreground">
              {dayLabels[index]}
            </span>
            <span className="mt-1 block truncate text-xs font-semibold tabular-nums">
              {minutes ? formatHours(minutes) : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Total hours{" "}
          <strong className="ml-1 text-base text-foreground">
            {formatDuration(person.minutes)}
          </strong>
        </p>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {canEdit &&
            !person.locked &&
            person.entries.some(
              (entry) => entry.status === "draft" && !!entry.ended_at,
            ) && (
              <Button
                type="button"
                variant="outline"
                className="min-w-0 flex-1 px-3"
                disabled={
                  busy || person.entries.some((entry) => !entry.ended_at)
                }
                onClick={(event) => {
                  event.stopPropagation();
                  void submitForReview(person);
                }}
              >
                Submit for review
              </Button>
            )}
          <Button
            type="button"
            variant="outline"
            className="min-w-0 flex-1 px-3 sm:flex-none"
            aria-label={`Review ${person.name}`}
            onClick={(event) => {
              event.stopPropagation();
              openDrawer(person, event.currentTarget);
            }}
          >
            Review <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">{lastReviewedLine(person.id)}</p>
        <Button
          ref={auditTriggerRef}
          type="button"
          variant="link"
          className="min-h-11 shrink-0 px-2 text-sm"
          onClick={(event) => {
            event.stopPropagation();
            auditTriggerRef.current = event.currentTarget;
            setAuditDialog({ personId: person.id, personName: person.name, week: selectedWeek });
          }}
        >
          History
        </Button>
      </div>
    </article>
  );
  const renderDesktopRow = (person: PersonWeek) => (
    <tr
      key={person.id}
      data-testid={`timesheet-member-${person.id}`}
      tabIndex={0}
      aria-label={`Review ${person.name}`}
      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      onClick={(event) => openDrawer(person, event.currentTarget)}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          openDrawer(person, event.currentTarget);
        }
      }}
    >
      <th scope="row" className="min-w-52 px-3 py-3 text-left font-normal">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent-foreground"
          >
            {person.name
              .split(/\s+/)
              .map((word) => word[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {person.name}
            </span>
            <span className="block text-sm text-muted-foreground">
              {roleLabelsLocal(
                person.role as "labourer" | "supervisor" | "admin",
              )}
            </span>
            <span className="mt-1 block max-w-56 truncate text-xs text-muted-foreground">{lastReviewedLine(person.id)}</span>
          </span>
        </div>
      </th>
      {person.daily.map((minutes, index) => (
        <td key={index} className="px-1 py-3 text-center">
          <span
            className={`mx-auto block min-w-12 rounded-lg px-1 py-2 text-sm font-semibold tabular-nums ${dayIsToday(index) ? "bg-primary/20 text-foreground" : "text-muted-foreground"}`}
          >
            {minutes ? formatHours(minutes) : "—"}
          </span>
        </td>
      ))}
      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">
        {formatDuration(person.minutes)}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col items-start gap-1">
          <TimesheetStatusBadge status={person.status} />
          <Button
            ref={auditTriggerRef}
            type="button"
            variant="link"
            className="min-h-11 px-0 text-sm"
            onClick={(event) => {
              event.stopPropagation();
              auditTriggerRef.current = event.currentTarget;
              setAuditDialog({ personId: person.id, personName: person.name, week: selectedWeek });
            }}
          >
            History
          </Button>
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <Button
          type="button"
          variant="outline"
          aria-label={`Review ${person.name}`}
          onClick={(event) => {
            event.stopPropagation();
            openDrawer(person, event.currentTarget);
          }}
        >
          Review <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
  return (
    <section className={card} aria-labelledby="review-weekly-title">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 p-4 backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              id="review-weekly-title"
              tabIndex={-1}
              className="text-xl font-bold"
            >
              Weekly time review
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review each person’s recorded week and resolve hours in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WeekSwitcher
              value={selectedWeek}
              onChange={setSelectedWeek}
              today={todayDate}
              id="review-week"
            />
            {canReview && submittedPeople.length > 0 && (
              <Button
                ref={approveAllTriggerRef}
                className={primary}
                onClick={() => setConfirmApproveAll(true)}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve all submitted
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button ref={auditTriggerRef} type="button" variant="outline" className="min-h-11 gap-2" aria-label="Timesheet options">
                  <MoreHorizontal className="h-4 w-4" />
                  <span>More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="min-h-11" onSelect={() => setAuditDialog({})}>
                  <History className="mr-2 h-4 w-4" />
                  Review history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {batchResult && (
          <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm">
            {batchResult}
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm">
            {message}
          </p>
        )}
        {error && !selected && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </header>
      <div className="border-b border-border p-4 sm:p-5">
        <SummaryStrip
          metrics={[
            {
              label: "Total hours",
              value: formatDuration(paidMinutes),
              tooltip: `Includes ${formatDuration(weekTotals.breakMinutes)} of unpaid breaks removed`,
            },
            ...(awaitingMinutes > 0 ? [{
              label: "Needs approval",
              value: formatDuration(awaitingMinutes),
              detail: `${awaiting.length} team member${awaiting.length === 1 ? "" : "s"}`,
              tone: "warning" as const,
            }] : []),
            ...(weekTotals.draftMinutes > 0 ? [{ label: "Not yet submitted", value: formatDuration(weekTotals.draftMinutes) }] : []),
            ...(approvedMinutes > 0 ? [{
              label: "Approved",
              value: formatDuration(approvedMinutes),
              tone: "success" as const,
            }] : []),
            ...(canViewPay
              ? [
                  {
                    label: "Estimated approved pay",
                    value:
                      estimatedPay === null
                        ? "Unavailable"
                        : new Intl.NumberFormat("en-AU", {
                            style: "currency",
                            currency: "AUD",
                          }).format(estimatedPay),
                    tooltip: "Estimate uses approved hours only and excludes tax, super, overtime, deductions and payments made.",
                    warning: weekTotals.missingRateCount ? `${weekTotals.missingRateCount} missing rate${weekTotals.missingRateCount === 1 ? "" : "s"}` : undefined,
                    warningTooltip: `${weekTotals.missingRateCount} approved ${weekTotals.missingRateCount === 1 ? "entry is" : "entries are"} missing a recorded rate. Estimated approved pay may be incomplete.`,
                  },
                ]
              : []),
          ]}
          runningCount={runningCount}
        />
      </div>
      <nav
        className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2"
        aria-label="Filter timesheets"
      >
        {(
          [
            "All",
            "Needs review",
            "Approved",
            "Drafts",
            "Missing hours",
          ] as Filter[]
        ).map((name) => (
          <button
            key={name}
            type="button"
            className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold ${filter === name ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            aria-pressed={filter === name}
            onClick={() => setFilter(name)}
          >
            {name} <span className="ml-1 tabular-nums">{counts[name]}</span>
          </button>
        ))}
      </nav>
      {showNoWeekData || filtered.length === 0 ? (
        <EmptyState
          onJump={lastWeek ? () => setSelectedWeek(lastWeek) : undefined}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table
              className="w-full min-w-[900px] border-collapse text-sm"
              aria-label="Weekly team timesheets"
            >
              <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Team member
                  </th>
                  {dayLabels.map((day, index) => (
                    <th
                      key={day}
                      scope="col"
                      className={`px-1 py-3 text-center font-semibold ${dayIsToday(index) ? "text-foreground" : ""}`}
                    >
                      {day}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-3 py-3 text-right font-semibold"
                  >
                    Total
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3 text-right font-semibold"
                  >
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>{filtered.map(renderDesktopRow)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-border md:hidden">
            {filtered.map(renderPerson)}
          </div>
        </>
      )}
      {selected && (
        <div
          className="fixed inset-0 z-40 bg-foreground/35"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeDrawer()
          }
          onKeyDown={(event) => trapModalFocus(event, closeDrawer, busy)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} timesheet review`}
            data-testid="timesheet-review-drawer"
            className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-background shadow-elevated sm:max-w-3xl"
          >
            <header className="border-b border-border p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-12 w-12 place-items-center rounded-full bg-accent/20 text-lg font-bold"
                  >
                    {selected.name
                      .split(/\s+/)
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div>
                    <h2 className="text-xl font-bold">{selected.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {roleLabelsLocal(
                        selected.role as "labourer" | "supervisor" | "admin",
                      )}{" "}
                      · Week of {showDate(selectedWeek)}
                    </p>
                  </div>
                </div>
                <Button
                  ref={drawerCloseRef}
                  type="button"
                  variant="outline"
                  aria-label="Close review"
                  onClick={closeDrawer}
                >
                  Close
                </Button>
              </div>
              {selectedTotals && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-muted p-3">
                  <p className="text-sm text-muted-foreground">Total hours <strong className="ml-1 text-lg text-foreground">{formatDuration(selectedTotals.paidMinutes)}</strong></p>
                  <TimesheetStatusBadge status={selected.status} />
                  <InfoPopover
                    label={`Unpaid breaks removed: ${formatDuration(selectedTotals.breakMinutes)}`}
                    content={`Includes ${formatDuration(selectedTotals.breakMinutes)} of unpaid breaks removed`}
                    className="px-2 text-sm text-muted-foreground underline decoration-dotted underline-offset-4"
                  >
                    Break details
                  </InfoPopover>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{lastReviewedLine(selected.id)}</p>
                <Button
                  ref={auditTriggerRef}
                  type="button"
                  variant="link"
                  className="min-h-11 px-2"
                  onClick={(event) => {
                    auditTriggerRef.current = event.currentTarget;
                    setAuditDialog({ personId: selected.id, personName: selected.name, week: selectedWeek });
                  }}
                >
                  History
                </Button>
              </div>
              {selected.locked && (
                <div className="mt-4">
                  <LockNotice />
                </div>
              )}
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <div className="hidden md:block">
                <EntriesTable>
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      {[
                        "Date",
                        "Job",
                        "Start–End",
                        "Break",
                        "Paid",
                        "Notes",
                        "Actions",
                      ].map((heading) => (
                        <th
                          scope="col"
                          key={heading}
                          className="px-3 py-3 font-semibold"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selected.entries.map((entry) => (
                      <tr
                        key={entry.id}
                        data-testid={`timesheet-entry-${entry.id}`}
                      >
                        <td className="px-3 py-3">
                          {formatDay(entry.work_date)}
                        </td>
                        <td className="px-3 py-3">
                          {team.jobs.find((job) => job.id === entry.project_id)
                            ?.name ?? "Job"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {formatClock(entry.started_at, team.timezone)} –{" "}
                          {formatClock(entry.ended_at, team.timezone)}
                        </td>
                        <td className="px-3 py-3">{formatDuration(entry.break_minutes)} break</td>
                        <td className="px-3 py-3 tabular-nums">
                          {formatDuration(paid(entry))}
                        </td>
                        <td className="max-w-40 px-3 py-3">
                          {entry.notes || "—"}
                        </td>
                        <td className="px-3 py-3">{entryMenu(entry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </EntriesTable>
              </div>
              <div className="space-y-3 md:hidden">
                {selected.entries.map((entry) => (
                  <EntryCard key={entry.id}>
                    <div data-testid={`timesheet-entry-${entry.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {team.jobs.find(
                              (job) => job.id === entry.project_id,
                            )?.name ?? "Job"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatDay(entry.work_date)} ·{" "}
                            {formatClock(entry.started_at, team.timezone)} –{" "}
                            {formatClock(entry.ended_at, team.timezone)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatDuration(paid(entry))}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatDuration(entry.break_minutes)} break{" "}
                        {entry.notes && `· ${entry.notes}`}
                      </p>
                      <div className="mt-3 flex justify-end">
                        {entryMenu(entry)}
                      </div>
                    </div>
                  </EntryCard>
                ))}
              </div>
              {selected.entries.length === 0 && (
                <EmptyState
                  title="No hours recorded"
                  detail="There are no time entries for this person in the selected week."
                />
              )}
              {selected.submission?.review_comment && (
                <p className="rounded-xl bg-muted p-3 text-sm">
                  <strong>Review note:</strong>{" "}
                  {selected.submission.review_comment}
                </p>
              )}
            </div>
            <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-background p-4 sm:p-5">
              {canEdit &&
                !selected.locked &&
                selected.entries.some(
                  (entry) => entry.status === "draft" && !!entry.ended_at,
                ) && (
                  <Button
                    variant="outline"
                    disabled={
                      busy || selected.entries.some((entry) => !entry.ended_at)
                    }
                    onClick={() => void submitForReview(selected)}
                  >
                    Submit for review
                  </Button>
                )}
              {canReview &&
                selected.id !== reviewerId &&
                selected.submission?.status === "submitted" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setReview(selected.submission!, "rejected")
                      }
                    >
                      Deny week
                    </Button>
                    <Button
                      className={primary}
                      onClick={() =>
                        setReview(selected.submission!, "approved")
                      }
                    >
                      Approve week
                    </Button>
                  </>
                )}
              {canReview &&
                selected.id !== reviewerId &&
                selected.submission &&
                selected.submission.status !== "submitted" && (
                  <Button
                    variant="outline"
                    onClick={() => setReview(selected.submission!, "reopen")}
                  >
                    Reopen week
                  </Button>
                )}
              {canReview &&
                selected.id !== reviewerId &&
                selected.submission?.status === "submitted" && (
                  <Button
                    variant="outline"
                    onClick={() => setReview(selected.submission!, "reopen")}
                  >
                    Reopen week
                  </Button>
                )}
            </footer>
          </aside>
        </div>
      )}
      {editingEntry && (
        <TimeEntryEditor
          entry={editingEntry}
          team={team}
          busy={busy}
          error={error}
          close={closeEditor}
          save={(payload) => void saveEntry(editingEntry, payload)}
        />
      )}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-foreground/35 p-4"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeDelete()
          }
          onKeyDown={(event) => trapModalFocus(event, closeDelete, busy)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="team-delete-title"
            className={`${card} w-full max-w-md p-5`}
          >
            <h2 id="team-delete-title" className="text-xl font-bold">
              Delete draft time entry?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes {employeeName(team, deleteTarget.employee_id)}’s{" "}
              {showDate(deleteTarget.work_date)} entry. The action will be
              recorded in the audit trail.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <Label htmlFor="delete-entry-reason" className="mt-4 block">
              Correction reason (optional)
            </Label>
            <Textarea
              id="delete-entry-reason"
              className="mt-2 min-h-20"
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Add context for the audit trail."
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                autoFocus
                variant="outline"
                disabled={busy}
                onClick={closeDelete}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void deleteEntry()}
              >
                {busy ? "Deleting…" : "Delete entry"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmApproveAll && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeApproveAll()
          }
          onKeyDown={(event) => trapModalFocus(event, closeApproveAll, busy)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="approve-all-title"
            className={`${card} max-h-[90dvh] w-full max-w-lg overflow-y-auto p-5`}
          >
            <h2 id="approve-all-title" className="text-xl font-bold">
              Approve all submitted weeks?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Each submission is approved separately. You can review the result
              for every person after the requests finish.
            </p>
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              {submittedPeople.map((person) => (
                <li key={person.id} className="flex justify-between gap-3 p-3">
                  <span>{person.name}</span>
                  <strong>{formatDuration(person.minutes)}</strong>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                autoFocus
                variant="outline"
                disabled={busy}
                onClick={closeApproveAll}
              >
                Cancel
              </Button>
              <Button
                className={primary}
                disabled={busy}
                onClick={() => void approveAll()}
              >
                {busy ? "Approving…" : "Approve all submitted"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <TimesheetAuditHistory
        rows={auditRows}
        employees={team.employees}
        timezone={team.timezone}
        personId={auditDialog?.personId}
        personName={auditDialog?.personName}
        week={auditDialog?.week}
        open={!!auditDialog}
        onOpenChange={(open) => {
          if (!open) {
            setAuditDialog(null);
            window.setTimeout(() => auditTriggerRef.current?.focus(), 0);
          }
        }}
      />
    </section>
  );
}
