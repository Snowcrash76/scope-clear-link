import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { PortalSubmission } from "../../../shared/employeePortal";

import {
  card,
  primary,
  outline,
  showDate,
  trapModalFocus,
} from "./portalShared";

export function ReviewDialog({
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
      className="fixed inset-0 z-50 grid place-items-center bg-muted/45 p-4"
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
          <p className="mt-2 rounded-xl bg-muted p-3 text-sm leading-5 text-muted-foreground">
            Reopening unlocks the whole week for corrections. If it was
            approved, its posted job labour cost is reversed. The employee or an
            admin must resubmit the corrected week before it can be approved and
            posted again.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Week commencing {showDate(review.submission.week_start)}.{" "}
            {review.decision === "approved"
              ? "Approval confirms these hours for posting to job labour."
              : "Denying returns the week to the employee for corrections and resubmission."}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
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
