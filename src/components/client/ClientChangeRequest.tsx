import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ClientChangeRequest({ onSubmit }: {
  onSubmit: (description: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  async function submit() {
    if (!description.trim()) {
      setError('Describe the change you would like.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!await onSubmit(description.trim())) {
        setError('Your request could not be sent. Your text is kept here so you can retry.');
        return;
      }
      setDescription('');
      setSent(true);
      setOpen(false);
    } catch {
      setError('Your request could not be sent. Your text is kept here so you can retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button variant="outline" className="min-h-11" onClick={() => { setOpen(true); setError(''); }}>
        Request a change
      </Button>
      {sent && <p role="status" className="text-sm text-muted-foreground">Change request sent. Your trade will review it and confirm any price or timing changes.</p>}
      <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a change</DialogTitle>
            <DialogDescription>Your request does not change the quote or its recorded decision. Your trade will review it and respond.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="client-change-description">What would you like changed?</Label>
            <Textarea id="client-change-description" value={description} onChange={event => setDescription(event.target.value)} disabled={busy} rows={5} className="text-sm" aria-invalid={!!error} aria-describedby={error ? 'client-change-error' : undefined} />
            {error && <p id="client-change-error" role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="min-h-11" disabled={busy} onClick={() => void submit()}>{busy ? 'Sending…' : 'Send change request'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
