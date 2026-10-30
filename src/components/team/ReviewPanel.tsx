import { useRef, useState } from "react";

import { Check, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { portalRequest } from "@/hooks/useEmployeePortal";

import { TimesheetSummary } from "@/components/TimesheetSummary";

import type {
  TeamBootstrap,
  PortalSubmission,
  PortalTimeEntry,
} from "../../../shared/employeePortal";
import { localDate, weekStart } from "../../../shared/employeePortal";
import {
  card,
  btn,
  primary,
  outline,
  field,
  errorText,
  showDate,
  showTime,
  trapModalFocus,
  employeeName,
} from "./portalShared";
import { TimeEntryEditor } from "./TimeEntryEditor";

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
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="review-weekly-title" tabIndex={-1} className="font-bold">
                Weekly time review
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
          <p className="mt-2 text-xs text-muted-foreground">
            Week starting {showDate(selectedWeek)} · pay estimates are visible
            to admins only.
          </p>
        </div>
        {mutationMessage && (
          <p
            role="status"
            className="border-b border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
          >
            {mutationMessage}
          </p>
        )}
        {mutationError && (
          <p
            role="alert"
            className="border-b border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
          >
            {mutationError}
          </p>
        )}
        <div className="border-b border-border bg-muted p-4 sm:p-5">
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
                className="border-b border-border p-4 last:border-0 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <b>{employee?.name ?? "Team member"}</b>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {employeeEntries.length} recorded{" "}
                      {employeeEntries.length === 1 ? "entry" : "entries"} ·
                      week of {showDate(selectedWeek)}
                    </p>
                    {submission && (
                      <span
                        className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${submission.status === "approved" ? "bg-muted text-muted-foreground" : submission.status === "submitted" ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"}`}
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
                    <p className="basis-full text-xs text-muted-foreground">
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
                        className="rounded-xl bg-muted p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b>
                            {team.jobs.find((j) => j.id === entry.project_id)
                              ?.name ?? "Job"}
                          </b>
                          <span className="rounded-full bg-background px-2 py-1 font-semibold capitalize text-muted-foreground">
                            {entry.status}
                          </span>
                        </div>
                        <span className="mt-1 block text-muted-foreground">
                          {showDate(entry.work_date)} ·{" "}
                          {showTime(entry.started_at, team.timezone)}–
                          {showTime(entry.ended_at, team.timezone)} ·{" "}
                          {entry.break_minutes}m unpaid break
                          {!entry.ended_at ? " · running clock excluded" : ""}
                        </span>
                        {entry.notes && (
                          <span className="mt-1 block text-muted-foreground">
                            {entry.notes}
                          </span>
                        )}
                        {entry.status !== "draft" || lockedWeek ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            This week is locked. Reopen the whole week before
                            correcting or deleting entries.
                          </p>
                        ) : !entry.ended_at ? (
                          <p className="mt-2 text-xs text-muted-foreground">
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
                                className={`${btn} !min-h-11 !px-3 border border-border bg-muted text-muted-foreground hover:bg-muted`}
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
                  <p className="mt-3 text-sm text-muted-foreground">
                    Review note: {submission.review_comment}
                  </p>
                )}
              </article>
            );
          })
        ) : (
          <div className="p-10 text-center">
            <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">No time recorded this week</p>
            <p className="mt-1 text-sm text-muted-foreground">
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
          className="fixed inset-0 z-50 grid place-items-center bg-muted/45 p-4"
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
              className="mt-2 text-sm leading-5 text-muted-foreground"
            >
              This removes {employeeName(team, deleteTarget.employee_id)}’s{" "}
              {showDate(deleteTarget.work_date)} entry. The action will be
              recorded in the audit trail.
            </p>
            {mutationError && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
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
                className={`${btn} border border-border bg-muted text-white hover:bg-muted`}
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
