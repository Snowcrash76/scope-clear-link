import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ReceiptReviewFieldsProps = {
  abn: string;
  currency: string;
  disabled?: boolean;
  onAbnChange: (value: string) => void;
};

export function ReceiptReviewFields({
  abn, currency, disabled = false, onAbnChange,
}: ReceiptReviewFieldsProps) {
  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="receipt-abn">Supplier ABN</Label>
          <Input id="receipt-abn" data-testid="input-receipt-abn" value={abn} maxLength={20} disabled={disabled} onChange={event => onAbnChange(event.target.value)} placeholder="Not read" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receipt-currency">Receipt currency</Label>
          <Input id="receipt-currency" data-testid="input-receipt-currency" value={currency} readOnly />
          <p className="text-[11px] text-muted-foreground">All receipt costs are recorded in AUD.</p>
        </div>
      </div>
    </div>
  );
}
