import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { portalRequest, useRefreshPortal } from "@/hooks/useEmployeePortal";
import { PhotoGallery } from "@/components/employee/PhotoGallery";
import type { TeamBootstrap } from "../../../shared/employeePortal";

const card =
  "rounded-2xl border border-border bg-card shadow-[0_3px_14px_rgba(33,54,43,.045)]";
const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50";
const primary = `${btn} bg-primary text-primary-foreground hover:bg-primary/90`;
const field =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
const showDate = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

export function UpdatesPanel({
  team,
  jobId,
}: {
  team: TeamBootstrap;
  jobId?: string;
}) {
  const notes = team.notes.filter(
    (note) => !jobId || note.project_id === jobId,
  );
  const docs = team.documents.filter(
    (document) => !jobId || document.project_id === jobId,
  );
  const jobs = team.jobs;
  const refresh = useRefreshPortal();
  const [job, setJob] = useState(jobId ?? jobs[0]?.id ?? "");
  const [phone, setPhone] = useState(
    jobs.find((item) => item.id === job)?.client_phone ?? "",
  );
  const [notesText, setNotesText] = useState(
    jobs.find((item) => item.id === job)?.employee_notes ?? "",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [visibilityTarget, setVisibilityTarget] = useState<
    TeamBootstrap["documents"][number] | null
  >(null);

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
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
    <AlertDialog
      open={!!visibilityTarget}
      onOpenChange={(open) => {
        if (!open) setVisibilityTarget(null);
      }}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <form className={`${card} p-5`} onSubmit={saveDetails}>
            <h2 className="font-bold">Operational job details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Team member notes are private to the team. Do not include
              commercial details.
            </p>
            <Label htmlFor="update-job" className="mt-4 block">
              Job
            </Label>
            <select
              id="update-job"
              className={`${field} mt-1.5`}
              value={job}
              onChange={(event) => {
                const selected = jobs.find(
                  (item) => item.id === event.target.value,
                );
                setJob(event.target.value);
                setPhone(selected?.client_phone ?? "");
                setNotesText(selected?.employee_notes ?? "");
              }}
            >
              {jobs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
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
              onChange={(event) => setPhone(event.target.value)}
            />
            <Label htmlFor="job-notes" className="mt-3 block">
              Team member notes
            </Label>
            <Textarea
              id="job-notes"
              className="mt-1.5 min-h-24"
              value={notesText}
              onChange={(event) => setNotesText(event.target.value)}
            />
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="mt-3 text-sm text-foreground">
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
              notes.map((note) => (
                <div key={note.id} className="border-t border-border py-3">
                  <p className="text-sm">{note.body}</p>
                  <small className="text-sm text-muted-foreground">
                    {showDate(note.created_at)}
                  </small>
                </div>
              ))
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No team member notes have been added.
              </p>
            )}
          </section>
        </div>
        <div className="space-y-4">
          <PhotoGallery documents={docs} />
          <section className={`${card} p-5`}>
            <h2 className="font-bold">Team-member document access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Publishing to team members is separate from client visibility.
              Check every file: it must not contain financial details.
            </p>
            {docs.length ? (
              docs
                .filter(
                  (document) =>
                    !(document.purpose || "").toLowerCase().includes("photo"),
                )
                .map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center gap-3 border-t border-border py-3 first:mt-4"
                  >
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm">
                        {document.display_name || document.file_name}
                      </b>
                      <small className="text-sm text-muted-foreground">
                        {document.purpose}
                      </small>
                    </div>
                    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={document.employee_visible}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setVisibilityTarget(document);
                          } else {
                            void visibility(document.id, false);
                          }
                        }}
                      />
                      Team-member visible
                    </label>
                  </div>
                ))
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No job documents. Publish a document from Documents section
                after checking its contents.
              </p>
            )}
          </section>
        </div>
      </div>
      <AlertDialogContent>
        <AlertDialogTitle>
          Publish this file to assigned team members?
        </AlertDialogTitle>
        <AlertDialogDescription>
          Assigned staff will be able to view this file. Check that it contains
          no rates, prices, or other financial details.
        </AlertDialogDescription>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel className="min-h-11 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-foreground">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              if (visibilityTarget) void visibility(visibilityTarget.id, true);
              setVisibilityTarget(null);
            }}
          >
            Publish to team
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
