import { useMemo, useState } from 'react';
import type { Invoice, ProjectStage, Quote } from '@/types/project';
import { getStageBilling, activeStageInvoice } from '@/lib/stageBilling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/RichTextEditor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, FileText, Receipt } from 'lucide-react';
import { toast } from 'sonner';

export type CreateStageInvoiceOptions = {
  dueDate?: string;
  notes?: string;
  terms?: string;
};

export interface StageInvoiceFormProps {
  /** Set stages to enable selection; omit for a fixed stage dialog. */
  stages?: ProjectStage[];
  /** A fixed stage when launched from the stage workflow. */
  stage?: ProjectStage | null;
  quote: Quote | null;
  invoices: Invoice[];
  onCreate: (stage: ProjectStage, options: CreateStageInvoiceOptions) => Promise<string | null>;
  onViewInvoice: (invoice: Invoice) => void;
  onCancel?: () => void;
  onCreated?: (invoiceId: string) => void;
  defaultNotes?: string;
  defaultTerms?: string;
  submitLabel?: string;
};

const money = (value: number) =>
  value.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });

export function StageInvoiceForm({
  stages,
  stage: fixedStage,
  quote,
  invoices,
  onCreate,
  onViewInvoice,
  onCancel,
  onCreated,
  defaultNotes = '',
  defaultTerms = '',
  submitLabel = 'Create stage invoice',
}: StageInvoiceFormProps) {
  const selectableStages = useMemo(
    () => stages?.filter(stage => stage.invoiceAmount !== undefined || stage.invoicePercentage !== undefined) ?? [],
    [stages],
  );
  const [selectedStageId, setSelectedStageId] = useState(fixedStage?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState(defaultNotes);
  const [terms, setTerms] = useState(defaultTerms);
  const [isSaving, setIsSaving] = useState(false);

  const selectedStage = fixedStage
    ?? selectableStages.find(candidate => candidate.id === selectedStageId)
    ?? null;
  const activeInvoice = selectedStage ? activeStageInvoice(invoices, selectedStage.id) : undefined;

  let billing: ReturnType<typeof getStageBilling> | null = null;
  let billingError = '';
  if (selectedStage) {
    try {
      billing = getStageBilling(selectedStage, quote);
    } catch (error) {
      billingError = error instanceof Error ? error.message : 'This stage allocation cannot be invoiced.';
    }
  }

  const handleSubmit = async () => {
    if (!selectedStage || !billing || activeInvoice || isSaving) return;
    setIsSaving(true);
    try {
      const invoiceId = await onCreate(selectedStage, {
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
      });
      if (invoiceId) {
        onCreated?.(invoiceId);
      } else {
        toast.error('The stage invoice could not be created. Check the details and try again.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The stage invoice could not be created. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {stages && (
        <div className="space-y-2">
          <Label htmlFor="stage-invoice-stage">Saved stage</Label>
          <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={isSaving}>
            <SelectTrigger id="stage-invoice-stage" aria-label="Choose saved stage">
              <SelectValue placeholder="Choose a stage" />
            </SelectTrigger>
            <SelectContent>
              {selectableStages.map(candidate => {
                let label = candidate.name;
                try {
                  label += ` · ${getStageBilling(candidate, quote).allocationLabel} · ${money(getStageBilling(candidate, quote).subtotal)} ex GST`;
                } catch {
                  label += ' · allocation needs attention';
                }
                const invoice = activeStageInvoice(invoices, candidate.id);
                return (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {invoice ? `${label} · already invoiced` : label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {selectableStages.length === 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
              No saved stages have an invoice allocation yet. Add an amount or percentage to a stage before creating its invoice.
            </p>
          )}
        </div>
      )}

      {selectedStage && billing && (
        <section className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4" aria-label="Stage invoice preview">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Receipt className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{selectedStage.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{billing.allocationLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {billing.quoteNumber ? `Quote ${billing.quoteNumber}` : 'Fixed allocation · no linked quote'}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">Subtotal · ex GST</p>
              <p className="text-xl font-semibold tabular-nums">{money(billing.subtotal)}</p>
              <div className="mt-3 flex justify-between gap-3 border-t border-primary/15 pt-3 text-sm">
                <span>GST ({billing.taxRate}%)</span>
                <span className="tabular-nums">{money(billing.taxAmount)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-3 font-semibold">
                <span>Total · inc GST</span>
                <span className="tabular-nums">{money(billing.total)}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeInvoice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            This stage already has an invoice ({activeInvoice.invoiceNumber} · {activeInvoice.status}).
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => onViewInvoice(activeInvoice)}>
            <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
            View invoice
          </Button>
        </div>
      )}

      {selectedStage && billingError && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{billingError}</span>
        </p>
      )}
      {stages && selectedStage && !quote && !billingError && !billing && (
        <p className="text-sm text-muted-foreground" role="status">A saved quote is required to calculate this stage invoice.</p>
      )}
      {!selectedStage && stages && selectableStages.length > 0 && (
        <p className="text-sm text-muted-foreground" role="status">Choose a saved stage to preview its invoice.</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="stage-invoice-due-date">Due date</Label>
        <Input id="stage-invoice-due-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stage-invoice-notes">Payment instructions / notes</Label>
        <RichTextEditor value={notes} onChange={setNotes} placeholder="Bank details and payment reference for your client..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stage-invoice-terms">Terms &amp; conditions</Label>
        <RichTextEditor value={terms} onChange={setTerms} placeholder="Payment terms and other conditions..." />
      </div>

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={handleSubmit}
          disabled={!selectedStage || !billing || !!activeInvoice || isSaving}
        >
          {isSaving ? 'Creating…' : submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}

export interface StageInvoiceDialogProps {
  open: boolean;
  stage: ProjectStage | null;
  quote: Quote | null;
  invoices: Invoice[];
  onOpenChange: (open: boolean) => void;
  onCreate: (stage: ProjectStage, options: CreateStageInvoiceOptions) => Promise<string | null>;
  onViewInvoice: (invoice: Invoice) => void;
  defaultNotes?: string;
  defaultTerms?: string;
}

export function StageInvoiceDialog({
  open,
  stage,
  quote,
  invoices,
  onOpenChange,
  onCreate,
  onViewInvoice,
  defaultNotes,
  defaultTerms,
}: StageInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg flex-col overflow-hidden p-4 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:p-6">
        <DialogHeader>
          <DialogTitle>Create stage invoice</DialogTitle>
          <DialogDescription>
            Use the allocation saved on this stage. The invoice is calculated from the saved quote, not the current scope.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain py-3">
          {stage ? (
            <StageInvoiceForm
              key={stage.id}
              stage={stage}
              quote={quote}
              invoices={invoices}
              onCreate={onCreate}
              onViewInvoice={onViewInvoice}
              onCancel={() => onOpenChange(false)}
              onCreated={() => onOpenChange(false)}
              defaultNotes={defaultNotes}
              defaultTerms={defaultTerms}
            />
          ) : (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
              Choose a stage with a saved invoice allocation to continue.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
