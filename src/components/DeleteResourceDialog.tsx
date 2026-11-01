import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteResource, type DeletionTarget } from '@/lib/resourceDeletion';

export function DeleteResourceDialog({ target, label, onClose, onDeleted }: {
  target: DeletionTarget | null; label: string; onClose: () => void; onDeleted?: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const close = () => { if (!busy) { setConfirmation(''); onClose(); } };
  const remove = async () => {
    if (!target || confirmation !== 'DELETE' || busy) return;
    setBusy(true);
    try {
      const result = await deleteResource(target);
      await queryClient.invalidateQueries();
      toast.success(`${target.kind === 'client' ? 'Client and linked records' : target.kind === 'quote' ? 'Quote' : 'Invoice'} deleted`, {
        description: result.filesPending ? 'Stored attachment cleanup is pending and will be retried automatically.' : undefined,
      });
      setConfirmation('');
      onClose();
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Deletion could not be confirmed. Refresh before retrying.');
    } finally { setBusy(false); }
  };
  return <Dialog open={!!target} onOpenChange={open => !open && close()}>
    <DialogContent className="max-w-lg" onEscapeKeyDown={event => busy && event.preventDefault()} onPointerDownOutside={event => busy && event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Delete {target?.kind} permanently?</DialogTitle>
        <DialogDescription>
          <strong>{label}</strong>. {target?.kind === 'client'
            ? 'This wipes this client and all their jobs, quotes, invoices (including sent and paid), costs, receipt attachments, documents and linked timesheet records. Team login accounts remain. Stored files are removed after the records; temporary storage failures are queued for automatic retry.'
            : target?.kind === 'quote'
              ? 'This removes the quote and its line items/history. The job and invoices remain; invoices lose their link to this quote.'
              : 'This removes the invoice and its line items and delivery history, even if sent or paid. The job and quote remain.'}
          {' '}This cannot be undone. Export any records you need to retain first.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="confirm-resource-delete">Type DELETE to confirm</Label>
        <Input id="confirm-resource-delete" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={busy} onClick={close}>Cancel</Button>
        <Button variant="destructive" disabled={busy || confirmation !== 'DELETE'} onClick={remove}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
