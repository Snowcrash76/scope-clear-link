import { useEffect, useMemo, useState } from 'react';
import type { Invoice } from '@/types/project';
import { calculateEditableInvoice } from '@/lib/invoiceWorkflow';
import type { InvoiceEditInput } from '@/lib/invoiceWorkflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';

interface InvoiceEditDialogProps {
  open: boolean;
  invoice: Invoice | null;
  onOpenChange: (open: boolean) => void;
  onSave: (invoice: Invoice, values: InvoiceEditInput) => Promise<boolean>;
}

const money = (amount: number) =>
  amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });

const dateInputValue = (date?: Date) => {
  if (!date) return '';
  const value = new Date(date);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export function InvoiceEditDialog({ open, invoice, onOpenChange, onSave }: InvoiceEditDialogProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [taxRate, setTaxRate] = useState('10');
  const [lineItems, setLineItems] = useState<InvoiceEditInput['lineItems']>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!invoice || !open) return;
    setInvoiceNumber(invoice.invoiceNumber);
    setDueDate(dateInputValue(invoice.dueDate));
    setNotes(invoice.notes || '');
    setTerms(invoice.terms || '');
    setTaxRate(String(invoice.taxRate));
    setLineItems(invoice.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      // Keep the source precision; only totals are rounded for the preview.
      unitPrice: item.unitPrice,
      scopeItemId: item.scopeItemId,
      changeRequestId: item.changeRequestId,
    })));
    setErrorMessage('');
  }, [invoice, open]);

  const input: InvoiceEditInput = {
    invoiceNumber,
    dueDate: dueDate || undefined,
    notes,
    terms,
    taxRate: Number(taxRate),
    lineItems,
  };
  const preview = useMemo(() => {
    try {
      return { value: calculateEditableInvoice(input), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'Check the invoice details.' };
    }
  // Input is intentionally reconstructed from the controlled fields.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceNumber, dueDate, notes, terms, taxRate, lineItems]);

  const updateLine = (index: number, updates: Partial<InvoiceEditInput['lineItems'][number]>) => {
    setLineItems(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...updates } : line));
    setErrorMessage('');
  };

  const handleSave = async () => {
    if (!invoice || isSaving) return;
    if (preview.error) {
      setErrorMessage(preview.error);
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      const succeeded = await onSave(invoice, input);
      if (succeeded) onOpenChange(false);
      else setErrorMessage('The invoice could not be saved. Your changes are still here—please retry.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The invoice could not be saved. Your changes are still here—please retry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => {
      if (!isSaving) onOpenChange(nextOpen);
    }}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden p-4 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit invoice</DialogTitle>
          <DialogDescription>
            Changes return the invoice to Pending approval. Nothing is sent to your client until you approve and send it.
          </DialogDescription>
        </DialogHeader>
        {invoice && (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain py-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-invoice-reference">Invoice reference</Label>
                  <Input id="edit-invoice-reference" value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} maxLength={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-invoice-due-date">Due date</Label>
                  <Input id="edit-invoice-due-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
                </div>
              </div>

              <section className="space-y-3" aria-label="Editable invoice line items">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Line items</h3>
                    <p className="text-sm text-muted-foreground">Edit descriptions, quantities and unit prices.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => {
                    setLineItems(items => [...items, { description: '', quantity: 1, unitPrice: 0 }]);
                    setErrorMessage('');
                  }} disabled={isSaving}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Add line
                  </Button>
                </div>
                <div className="space-y-3">
                  {lineItems.map((line, index) => (
                    <div key={`${invoice.id}-line-${index}`} className="grid min-w-0 gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto] sm:items-end">
                      <div className="min-w-0 space-y-2 sm:col-span-1">
                        <Label htmlFor={`invoice-line-description-${index}`}>Description</Label>
                        <Input id={`invoice-line-description-${index}`} value={line.description} onChange={event => updateLine(index, { description: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`invoice-line-quantity-${index}`}>Quantity</Label>
                        <Input id={`invoice-line-quantity-${index}`} inputMode="decimal" type="number" min="0" step="any" value={line.quantity} onChange={event => updateLine(index, { quantity: event.target.value === '' ? 0 : Number(event.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`invoice-line-price-${index}`}>Unit price</Label>
                        <div className="flex items-center gap-1.5">
                          <span aria-hidden="true" className="text-sm text-muted-foreground">$</span>
                          <Input id={`invoice-line-price-${index}`} inputMode="decimal" type="number" min="0" step="any" value={line.unitPrice} onChange={event => updateLine(index, { unitPrice: event.target.value === '' ? 0 : Number(event.target.value) })} />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${index + 1}`} onClick={() => {
                        setLineItems(items => items.filter((_, lineIndex) => lineIndex !== index));
                        setErrorMessage('');
                      }} disabled={isSaving} className="justify-self-end text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  {lineItems.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Add at least one line item to calculate this invoice.</p>}
                </div>
              </section>

              <div className="space-y-2">
                <Label htmlFor="edit-invoice-tax">GST rate (%)</Label>
                <Input id="edit-invoice-tax" type="number" min="0" step="any" value={taxRate} onChange={event => { setTaxRate(event.target.value); setErrorMessage(''); }} />
              </div>

              <section className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4" aria-label="Invoice totals preview" aria-live="polite">
                <h3 className="font-semibold">Totals preview · AUD</h3>
                {preview.value ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(preview.value.subtotal)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">GST ({taxRate || 0}%)</span><span className="tabular-nums">{money(preview.value.taxAmount)}</span></div>
                    <div className="flex justify-between gap-4 border-t border-primary/15 pt-2 text-base font-semibold"><span>Total · inc GST</span><span className="tabular-nums">{money(preview.value.total)}</span></div>
                  </div>
                ) : <p className="mt-2 text-sm text-muted-foreground">{preview.error}</p>}
              </section>

              <div className="space-y-2">
                <Label>Payment instructions / notes</Label>
                <RichTextEditor value={notes} onChange={setNotes} placeholder="Bank details and payment reference for your client..." />
              </div>
              <div className="space-y-2">
                <Label>Terms &amp; conditions</Label>
                <RichTextEditor value={terms} onChange={setTerms} placeholder="Payment terms and other conditions..." />
              </div>

              {(errorMessage || preview.error) && (
                <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
                  {errorMessage || preview.error}
                </p>
              )}
            </div>
            <DialogFooter className="shrink-0 flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
              <Button type="button" className="w-full sm:w-auto" onClick={handleSave} disabled={isSaving || !preview.value}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
