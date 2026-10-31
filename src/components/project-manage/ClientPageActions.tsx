import { useState } from "react";
import { Copy, ExternalLink, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { getClientProjectUrl } from "@/lib/utils";
import { portalRequest } from "@/hooks/useEmployeePortal";
import type { Project } from "@/types/project";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type SendResult = {
  success: true;
  messageId: string | null;
  markedSent: boolean;
  activityRecorded: false;
  copySent: boolean;
  warning?: string;
};

export function ClientPageActions({
  project,
  onAddEmail,
  onSendSuccess,
  layout = "inline",
}: {
  project: Project;
  onAddEmail: () => void;
  onSendSuccess?: () => void | Promise<void>;
  layout?: "inline" | "menu";
}) {
  const [sendOpen, setSendOpen] = useState(false);
  const [to, setTo] = useState(project.clientEmail ?? "");
  const [subject, setSubject] = useState(`Your project page — ${project.name}`);
  const [message, setMessage] = useState(
    `Hi ${project.clientName},\n\nHere's your project page for ${project.name}, where you can view your quote, approve variations and follow progress.\n\nPlease let me know if you have any questions.`,
  );
  const [sendCopy, setSendCopy] = useState(false);
  const [confirmDifferent, setConfirmDifferent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const differentRecipient =
    to.trim().toLowerCase() !== (project.clientEmail ?? "").trim().toLowerCase();

  async function copyLink() {
    try {
      const link = await getClientProjectUrl(project.id);
      await navigator.clipboard.writeText(link);
      toast.success("Secure client page link copied", { description: link });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy the secure client link.");
    }
  }

  async function preview() {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    if (!popup) {
      toast.error("Your browser blocked the preview window. Allow pop-ups and try again.");
      return;
    }
    try {
      popup.location.href = await getClientProjectUrl(project.id);
    } catch (err) {
      popup.close();
      toast.error(err instanceof Error ? err.message : "Could not open the secure client page.");
    }
  }

  async function send() {
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      setError("Enter a valid recipient email address.");
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setError("Add a subject and message before sending.");
      return;
    }
    if (differentRecipient && !confirmDifferent) {
      setError("Confirm that you want to send this link to an address different from the saved client email.");
      return;
    }
    setBusy(true);
    try {
      const result = await portalRequest<SendResult>("/send-client-page-link", {
        projectId: project.id,
        to: to.trim(),
        subject: subject.trim(),
        message: message.trim(),
        sendCopy,
        confirmDifferentRecipient: differentRecipient && confirmDifferent,
      });
      if (!result.success) throw new Error("The email could not be sent.");
      setSendOpen(false);
      setConfirmDifferent(false);
      if (onSendSuccess) void Promise.resolve(onSendSuccess()).catch(() => undefined);
      toast.success(`Client page sent to ${to.trim()}`, {
        description: result.warning ?? (result.markedSent ? "The draft job was also marked Sent." : "Email sent successfully."),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {layout === "menu" ? (
        <>
          <DropdownMenuItem onSelect={() => void preview()}><ExternalLink className="mr-2 h-4 w-4" />View client page</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyLink()}><Copy className="mr-2 h-4 w-4" />Copy client page link</DropdownMenuItem>
          <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setTo(project.clientEmail ?? ""); setError(""); setSendOpen(true); }}><Mail className="mr-2 h-4 w-4" />Send client page</DropdownMenuItem>
        </>
      ) : (
        <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 md:flex md:w-auto md:items-center md:gap-2" aria-label="Client page actions">
          <Button type="button" variant="outline" className="h-auto min-h-11 min-w-0 gap-1 whitespace-normal px-2 text-xs sm:text-sm md:whitespace-nowrap md:px-3 [&>svg]:hidden md:[&>svg]:block" onClick={() => void preview()}>
            <ExternalLink className="h-4 w-4" /> <span>View client page</span>
          </Button>
          <Button type="button" variant="outline" className="h-auto min-h-11 min-w-0 gap-1 whitespace-normal px-2 text-xs sm:text-sm md:whitespace-nowrap md:px-3 [&>svg]:hidden md:[&>svg]:block" onClick={() => void copyLink()}>
            <Copy className="h-4 w-4" /> <span>Copy link</span>
          </Button>
          <Button
            type="button"
            variant="accent"
            className="h-auto min-h-11 min-w-0 gap-1 whitespace-normal px-2 text-xs sm:text-sm md:whitespace-nowrap md:px-3 [&>svg]:hidden md:[&>svg]:block"
            onClick={() => {
              setTo(project.clientEmail ?? "");
              setError("");
              setSendOpen(true);
            }}
          >
            <Mail className="h-4 w-4 shrink-0" /> <span>Send to client</span>
          </Button>
        </div>
      )}
      <Dialog open={sendOpen} onOpenChange={(open) => !busy && setSendOpen(open)}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto sm:max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle>Email the client page</DialogTitle>
            <DialogDescription>
              The secure link is generated on the server and added to the email. It is never entered or stored here.
            </DialogDescription>
          </DialogHeader>
          {!project.clientEmail && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <p>No client email is saved for this job.</p>
              <Button type="button" variant="link" className="mt-1 h-auto min-h-11 p-0" onClick={() => { setSendOpen(false); onAddEmail(); }}>
                Add client email
              </Button>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-page-to">To</Label>
              <Input id="client-page-to" autoComplete="email" type="email" value={to} onChange={(event) => { setTo(event.target.value); setConfirmDifferent(false); }} />
            </div>
            {differentRecipient && (
              <label className="flex min-h-11 items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" checked={confirmDifferent} onChange={(event) => setConfirmDifferent(event.target.checked)} />
                <span>Send to a different address than the saved client email ({project.clientEmail || "none"})</span>
              </label>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="client-page-subject">Subject</Label>
              <Input id="client-page-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-page-message">Message</Label>
              <Textarea id="client-page-message" rows={6} value={message} onChange={(event) => setMessage(event.target.value)} />
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={sendCopy} onChange={(event) => setSendCopy(event.target.checked)} />
              Send me a copy
            </label>
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="font-semibold">Visible on the client page</p>
              <p className="mt-1 text-sm text-muted-foreground">Quote, approved variations, job progress and invoices intended for this client. Internal costs and team timesheets are not included.</p>
            </div>
            {project.status === "draft" && (
              <p className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm">
                Sending successfully will also mark this draft job as <strong>Sent</strong>.
              </p>
            )}
            {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button type="button" variant="accent" disabled={busy || !project.clientEmail && !to.trim()} onClick={() => void send()}>
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : "Send client page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
