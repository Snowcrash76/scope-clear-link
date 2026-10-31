import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Quote } from '@/types/project';
import { calculateQuoteInvoiceAmounts, type QuoteInvoiceAllocation } from '@/lib/quoteInvoice';

type AllocationType = QuoteInvoiceAllocation['type'];

interface QuoteInvoiceDialogProps {
  quote: Quote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (allocation: QuoteInvoiceAllocation) => Promise<boolean>;
}

const allocationOptions: { type: AllocationType; label: string; detail: string; preset: number }[] = [
  { type: 'final', label: 'Full invoice', detail: 'Invoice the full approved quote', preset: 100 },
  { type: 'deposit', label: 'Deposit', detail: 'Request an upfront payment', preset: 20 },
  { type: 'staged', label: 'Stage payment', detail: 'Invoice a project milestone', preset: 50 },
];

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
});

export function QuoteInvoiceDialog({ quote, open, onOpenChange, onCreate }: QuoteInvoiceDialogProps) {
  const [allocationType, setAllocationType] = useState<AllocationType>('final');
  const [percentage, setPercentage] = useState('100');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  useEffect(() => {
    if (open) {
      setAllocationType('final');
      setPercentage('100');
      setDescription('');
      setError('');
      setPending(false);
      submitting.current = false;
    }
  }, [open]);

  const parsedPercentage = Number(percentage);
  const validPercentage = percentage.trim() !== ''
    && /^\d+(?:\.\d{0,2})?$/.test(percentage)
    && Number.isFinite(parsedPercentage)
    && parsedPercentage > 0
    && parsedPercentage <= 100;

  const amounts = useMemo(() => {
    if (!validPercentage) return null;
    try {
      return calculateQuoteInvoiceAmounts(quote.subtotal, quote.taxRate, parsedPercentage);
    } catch {
      return null;
    }
  }, [quote.subtotal, quote.taxRate, parsedPercentage, validPercentage]);

  const percentageError = percentage.trim() === ''
    ? 'Enter a percentage.'
    : !/^\d+(?:\.\d{0,2})?$/.test(percentage)
      ? 'Use a number with up to 2 decimal places.'
      : parsedPercentage <= 0 || parsedPercentage > 100
        ? 'Enter a percentage greater than 0 and no more than 100.'
        : '';

  const selectAllocation = (type: AllocationType, preset: number) => {
    setAllocationType(type);
    setPercentage(String(preset));
    setError('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending || submitting.current) return;
    onOpenChange(nextOpen);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || submitting.current) return;
    if (!validPercentage || !amounts) {
      setError(percentageError || 'The saved quote amounts could not be calculated.');
      return;
    }

    submitting.current = true;
    setPending(true);
    setError('');

    const allocation: QuoteInvoiceAllocation = {
      type: allocationType,
      percentage: parsedPercentage,
      ...(description.trim() ? { description: description.trim() } : {}),
    };

    try {
      const created = await onCreate(allocation);
      if (created) {
        onOpenChange(false);
      } else {
        setError('The invoice could not be created. Please try again.');
      }
    } catch {
      setError('The invoice could not be created. Please try again.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby="invoice-dialog-description"
          className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-1.5rem)] max-h-[calc(100dvh-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 grid-cols-1 gap-0 overflow-y-auto rounded-xl border border-border bg-background p-0 text-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:w-[calc(100%-2rem)]"
          onEscapeKeyDown={(event) => { if (pending || submitting.current) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (pending || submitting.current) event.preventDefault(); }}
        >
          <form onSubmit={handleCreate} className="min-w-0">
            <header className="border-b border-border bg-muted/25 px-5 py-5 sm:px-7">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                  <FileText aria-hidden="true" className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogPrimitive.Title className="font-heading text-lg font-semibold tracking-tight">
                    Create invoice
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description id="invoice-dialog-description" className="mt-1 text-sm leading-5 text-muted-foreground">
                    Choose how much of quote {quote.quoteNumber} to invoice.
                  </DialogPrimitive.Description>
                </div>
              </div>
            </header>

            <div className="space-y-5 px-5 py-5 sm:px-7">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">Invoice allocation</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Invoice allocation type">
                  {allocationOptions.map(option => {
                    const selected = allocationType === option.type;
                    return (
                      <button
                        key={option.type}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectAllocation(option.type, option.preset)}
                        className={`min-h-[76px] rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-background hover:bg-muted/45'}`}
                      >
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="mt-1 block text-xs leading-4 text-muted-foreground">{option.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice-percentage">Quote percentage</Label>
                  <div className="relative">
                    <Input
                      id="invoice-percentage"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={percentage}
                      onChange={(event) => {
                        setPercentage(event.target.value);
                        setError('');
                      }}
                      aria-invalid={!validPercentage}
                      aria-describedby="invoice-percentage-hint"
                      disabled={pending || allocationType === 'final'}
                      className="pr-9"
                    />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                  </div>
                  <p id="invoice-percentage-hint" className={`text-xs ${!validPercentage ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {percentageError || 'Any amount above 0%, up to 100%.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-description">Payment description <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="invoice-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={allocationType === 'staged' ? 'e.g. Stage 1 — framing' : 'e.g. Initial deposit'}
                    maxLength={120}
                    disabled={pending}
                  />
                </div>
              </div>

              <section aria-label="Invoice amount preview" className="overflow-hidden rounded-lg border border-border bg-muted/25">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold">Invoice preview</h3>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                    {validPercentage ? `${parsedPercentage}% of quote` : 'Percentage required'}
                  </span>
                </div>
                <dl className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Subtotal <span className="text-xs">(ex GST)</span></dt>
                    <dd className="font-medium tabular-nums">{amounts ? aud.format(amounts.subtotal) : '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">GST ({quote.taxRate}%)</dt>
                    <dd className="font-medium tabular-nums">{amounts ? aud.format(amounts.taxAmount) : '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
                    <dt className="font-semibold">Total <span className="text-xs font-normal text-muted-foreground">(inc GST)</span></dt>
                    <dd className="text-base font-semibold tabular-nums">{amounts ? aud.format(amounts.total) : '—'}</dd>
                  </div>
                </dl>
              </section>

              <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-foreground">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="leading-5">
                  This percentage is calculated from the full saved quote. Existing invoices are not automatically deducted.
                </p>
              </div>

              {error && (
                <p role="alert" className="flex items-start gap-2 text-sm font-medium text-destructive">
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </p>
              )}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                disabled={pending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="min-h-11 w-full sm:w-auto"
                disabled={pending || !validPercentage || !amounts}
              >
                {pending ? 'Creating invoice…' : 'Create invoice'}
              </Button>
            </footer>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
