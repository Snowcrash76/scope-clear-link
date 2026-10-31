import { useEffect, useState } from "react";
import { Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ClientEditValues = {
  clientName: string;
  clientEmail: string;
  clientAddress: string;
};

export function ClientDetailsCard({
  project,
  onSave,
  open: controlledOpen,
  onOpenChange,
  compact = false,
}: {
  project: Project;
  onSave: (values: ClientEditValues, applyToAll: boolean) => Promise<boolean>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  compact?: boolean;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (next: boolean) => {
    setLocalOpen(next);
    onOpenChange?.(next);
  };
  const [name, setName] = useState(project.clientName ?? "");
  const [email, setEmail] = useState(project.clientEmail ?? "");
  const [address, setAddress] = useState(project.clientAddress ?? "");
  const [applyToAll, setApplyToAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(project.clientName ?? "");
    setEmail(project.clientEmail ?? "");
    setAddress(project.clientAddress ?? "");
    setApplyToAll(false);
    setError("");
  }, [open, project]);

  async function save() {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName) {
      setError("Enter the client’s name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const succeeded = await onSave({
        clientName: cleanName,
        clientEmail: cleanEmail,
        clientAddress: address.trim(),
      }, applyToAll);
      if (succeeded) setOpen(false);
      else setError("Client details could not be saved. Please retry.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Client details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const addressSearch = project.clientAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(project.clientAddress)}`
    : undefined;
  return (
    <>
      <section
        className={compact ? "min-w-0" : "rounded-xl border border-border bg-card p-4 shadow-soft"}
        aria-labelledby={compact ? undefined : "job-client-title"}
        aria-label={compact ? "Client details" : undefined}
      >
        {compact ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="max-w-full truncate font-medium text-foreground">{project.clientName || "Client details missing"}</span>
            {project.clientEmail ? (
              <a className="flex min-w-0 items-center gap-1.5 truncate hover:text-foreground hover:underline" href={`mailto:${project.clientEmail}`}>
                <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{project.clientEmail}</span>
              </a>
            ) : <span className="text-muted-foreground">No email saved</span>}
            {project.clientPhone && (
              <a className="flex min-w-0 items-center gap-1.5 hover:text-foreground hover:underline" href={`tel:${project.clientPhone.replace(/[^\d+]/g, "")}`}>
                <Phone className="h-3.5 w-3.5 shrink-0" /><span>{project.clientPhone}</span>
              </a>
            )}
            {project.clientAddress ? (
              <a className="flex min-w-0 items-center gap-1.5 truncate hover:text-foreground hover:underline" href={addressSearch} target="_blank" rel="noreferrer">
                <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{project.clientAddress}</span>
              </a>
            ) : <span className="text-muted-foreground">No address saved</span>}
            <Button type="button" variant="link" className="h-8 min-h-8 shrink-0 px-1 text-sm font-medium text-muted-foreground" onClick={() => setOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit client
            </Button>
          </div>
        ) : (
          <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="job-client-title" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Client</h2>
            <p className="mt-1 flex items-center gap-2 font-semibold"><User className="h-4 w-4 shrink-0 text-primary" />{project.clientName || "Client details missing"}</p>
          </div>
          <Button type="button" variant="outline" className="min-h-11 shrink-0 gap-2" onClick={() => setOpen(true)}>
            <Pencil className="h-4 w-4" />Edit
          </Button>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {project.clientEmail ? (
            <a className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-foreground underline-offset-2 hover:underline" href={`mailto:${project.clientEmail}`}>
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{project.clientEmail}</span>
            </a>
          ) : <p className="flex min-h-11 items-center gap-2 px-2 text-muted-foreground"><Mail className="h-4 w-4" />No email saved</p>}
          {project.clientPhone && (
            <a className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-foreground underline-offset-2 hover:underline" href={`tel:${project.clientPhone.replace(/[^\d+]/g, "")}`}>
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{project.clientPhone}</span>
            </a>
          )}
          {project.clientAddress ? (
            <a className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-foreground underline-offset-2 hover:underline" href={addressSearch} target="_blank" rel="noreferrer">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{project.clientAddress}</span>
            </a>
          ) : <p className="flex min-h-11 items-center gap-2 px-2 text-muted-foreground"><MapPin className="h-4 w-4" />No address saved</p>}
        </div>
          </>
        )}
      </section>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit client details</DialogTitle>
            <DialogDescription>Choose whether these contact details apply to this job only or all jobs for this client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="job-client-name">Client name</Label><Input id="job-client-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="job-client-email">Email</Label><Input id="job-client-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="job-client-address">Address</Label><Input id="job-client-address" autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} /></div>
            <fieldset className="space-y-2 rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-semibold">Apply changes</legend>
              <label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" checked={!applyToAll} onChange={() => setApplyToAll(false)} name="client-edit-scope" />Apply to this job only</label>
              <label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" checked={applyToAll} onChange={() => setApplyToAll(true)} name="client-edit-scope" />Apply to all jobs for this client</label>
            </fieldset>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" variant="accent" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save client details"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
