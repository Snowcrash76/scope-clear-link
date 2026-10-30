import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type {
  TeamBootstrap,
  PortalTimeEntry,
} from "../../../shared/employeePortal";
import {
  localDateTimeToUtc,
  paidMinutes,
} from "../../../shared/employeePortal";
import {
  card,
  primary,
  outline,
  field,
  errorText,
  trapModalFocus,
  datetimeForTimezone,
} from "./portalShared";

export function TimeEntryEditor({
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
      className="fixed inset-0 z-50 grid place-items-center bg-muted/45 p-3 sm:p-4"
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
        <p className="text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">
          Draft correction
        </p>
        <h2 id="team-entry-edit-title" className="mt-2 text-xl font-bold">
          Edit time entry
        </h2>
        <p className="mt-2 rounded-xl bg-muted p-3 text-sm leading-5 text-muted-foreground">
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
            <p className="mt-1 text-sm text-muted-foreground">
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
              className="rounded-xl bg-muted p-3 text-sm text-muted-foreground"
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
