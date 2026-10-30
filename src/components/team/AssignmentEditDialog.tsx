import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { PortalAssignment } from "../../../shared/employeePortal";
import { localDateTimeToUtc } from "../../../shared/employeePortal";
import {
  card,
  primary,
  outline,
  field,
  errorText,
  trapModalFocus,
} from "./portalShared";

export function AssignmentEditDialog({
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
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4"
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
        <p className="text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">
          Shared appointment
        </p>
        <h2 id="assignment-edit-title" className="mt-2 text-xl font-bold">
          Edit schedule
        </h2>
        <p className="mt-2 rounded-xl bg-warning/10 p-3 text-sm leading-5 text-foreground">
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
              className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
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
