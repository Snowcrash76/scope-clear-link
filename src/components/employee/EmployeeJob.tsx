import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, FileText, MapPin } from "lucide-react";
import {
  usePortal,
  useRefreshPortal,
  portalRequest,
  uploadEmployeePhoto,
} from "@/hooks/useEmployeePortal";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";

import type { EmployeeJobDetail } from "../../../shared/employeePortal";

import {
  card,
  primary,
  outline,
  field,
  fmtDate,
  getError,
  openCapabilityUrl,
} from "./portalShared";
import { LoadState } from "./LoadState";
import { PortalLayout } from "./PortalLayout";
import { PageTitle } from "./PageTitleView";
import { PhotoGallery } from "./PhotoGalleryView";

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
      toast.error(getError(e));
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
      toast.error(getError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PortalLayout>
      <Link
        to="/employee"
        className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground"
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
                  <p className="mt-2 text-sm text-muted-foreground">
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
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {q.data.job.employee_notes || "No specific site notes."}
                  </p>
                </section>
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Scope</h2>
                  {q.data.scope.length ? (
                    <ul className="mt-3 space-y-3">
                      {q.data.scope.map((s) => (
                        <li key={s.id} className="border-t border-border pt-3">
                          <b className="text-sm">{s.title}</b>
                          {s.description && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {s.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
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
                            className="border-t border-border pt-3"
                          >
                            <b className="text-sm">{v.title}</b>
                            {v.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {v.description}
                              </p>
                            )}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No approved variations published.
                    </p>
                  )}
                </section>
              </div>
              <div className="min-w-0 space-y-4">
                <section className={`${card} min-w-0 p-5`}>
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-bold">Site photos</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
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
                      <p className="break-all text-xs text-muted-foreground">
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
                  <p className="mt-1 text-xs text-muted-foreground">
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
                            className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border px-3 text-left text-sm"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">
                              {d.display_name || d.file_name}
                            </span>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No documents published for staff.
                    </p>
                  )}
                </section>
                <section className={`${card} p-5`}>
                  <h2 className="font-bold">Team updates</h2>
                  {q.data.notes.length ? (
                    <ul className="mt-3 space-y-3">
                      {q.data.notes.map((n) => (
                        <li key={n.id} className="border-t border-border pt-3">
                          <p className="text-sm">{n.body}</p>
                          <small className="mt-1 block text-muted-foreground">
                            {fmtDate(n.created_at)}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
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
