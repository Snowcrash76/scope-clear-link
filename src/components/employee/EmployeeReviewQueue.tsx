import { useState } from "react";

import { Check } from "lucide-react";
import {
  usePortal,
  useRefreshPortal,
  portalRequest,
} from "@/hooks/useEmployeePortal";

import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import type {
  PortalReviews,
  PortalSubmission,
} from "../../../shared/employeePortal";
import { weekStart } from "../../../shared/employeePortal";
import {
  card,
  primary,
  outline,
  fmtDate,
  fmtTime,
  mins,
  getError,
} from "./portalShared";

export function EmployeeReviewQueue({
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
      <div className="border-b border-border p-5">
        <h2 className="font-bold">Supervisor reviews</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review submitted weeks and all their entries within your authorised
          scope. You cannot approve your own week.
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="border-b border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          {message}
        </p>
      )}
      {q.isLoading ? (
        <div className="p-5">
          <div className="h-14 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : q.error ? (
        <div className="p-5" role="alert">
          <p className="text-sm text-muted-foreground">{q.error.message}</p>
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
              className="border-b border-border p-4 last:border-0"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <b>{employee?.name ?? "Team member"}</b>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Week of {fmtDate(s.week_start)} · {entries.length} entries ·{" "}
                    {mins(total)}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize">
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
                    className="rounded-xl bg-muted p-3 text-xs"
                  >
                    <b>
                      {q.data!.jobs.find((j) => j.id === entry.project_id)
                        ?.name ?? "Job"}
                    </b>
                    <span className="ml-2 text-muted-foreground">
                      {fmtDate(entry.work_date)} ·{" "}
                      {fmtTime(entry.started_at, timezone)}–
                      {fmtTime(entry.ended_at, timezone)} ·{" "}
                      {entry.break_minutes}m break
                    </span>
                    {entry.notes && (
                      <p className="mt-2 text-muted-foreground">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {s.review_comment && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {s.review_comment}
                </p>
              )}
            </div>
          );
        })
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No team submissions need review.
        </div>
      )}
      {selected && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-muted/45 p-4"
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
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
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
              <p role="alert" className="mt-2 text-sm text-muted-foreground">
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
