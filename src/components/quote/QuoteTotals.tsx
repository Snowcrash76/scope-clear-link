import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { aud } from '@/hooks/useJobCosts';

type QuoteTotalsProps = {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

type EditableQuoteTotalsProps = QuoteTotalsProps & {
  onTaxRateChange: (rate: number) => void;
};

export function EditableQuoteTotals({
  subtotal,
  taxRate,
  taxAmount,
  total,
  onTaxRateChange,
}: EditableQuoteTotalsProps) {
  return (
    <div className="min-w-0 space-y-3 border-t pt-4">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Subtotal (ex GST)</span>
        <span className="font-medium">{aud(subtotal)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <Label htmlFor="taxRate" className="whitespace-nowrap text-muted-foreground">GST rate (%)</Label>
        <Input
          id="taxRate"
          type="number"
          value={taxRate}
          onChange={event => onTaxRateChange(parseFloat(event.target.value) || 0)}
          className="w-24"
        />
        <span className="ml-auto whitespace-nowrap font-medium" aria-label="GST amount">GST {aud(taxAmount)}</span>
      </div>
      <div className="flex justify-between border-t pt-3 text-lg font-bold">
        <span>Total (inc GST)</span>
        <span className="text-primary">{aud(total)}</span>
      </div>
    </div>
  );
}

export function QuoteTotalsSummary({ subtotal, taxRate, taxAmount, total }: QuoteTotalsProps) {
  return (
    <div className="mb-4 grid gap-3 rounded-lg border border-border bg-muted/25 p-4 sm:grid-cols-3">
      <div className="flex items-center justify-between gap-3 sm:block">
        <p className="text-sm text-muted-foreground">Subtotal <span className="text-xs">ex GST</span></p>
        <p className="tabular-nums text-base font-semibold">{aud(subtotal)}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:block">
        <p className="text-sm text-muted-foreground">GST ({taxRate}%)</p>
        <p className="tabular-nums text-base font-semibold">{aud(taxAmount)}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2 sm:block sm:border-0 sm:pt-0">
        <p className="text-sm font-semibold text-foreground">Total <span className="text-xs font-normal text-muted-foreground">inc GST</span></p>
        <p className="tabular-nums text-lg font-bold text-primary">{aud(total)}</p>
      </div>
    </div>
  );
}
