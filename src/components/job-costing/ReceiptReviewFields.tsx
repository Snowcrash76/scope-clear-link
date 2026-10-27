import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ReceiptReviewFieldsProps = {
  abn: string;
  currency: string;
  currencyConfirmed: boolean;
  disabled?: boolean;
  onAbnChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onCurrencyConfirmedChange: (value: boolean) => void;
};

export function ReceiptReviewFields({
  abn, currency, currencyConfirmed, disabled = false,
  onAbnChange, onCurrencyChange, onCurrencyConfirmedChange,
}: ReceiptReviewFieldsProps) {
  const isAud = currency === 'AUD';
  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="receipt-abn">Supplier ABN</Label>
          <Input id="receipt-abn" data-testid="input-receipt-abn" value={abn} maxLength={20} disabled={disabled} onChange={event => onAbnChange(event.target.value)} placeholder="Not read" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receipt-currency">Receipt currency</Label>
          <Input id="receipt-currency" data-testid="input-receipt-currency" value={currency} maxLength={3} disabled={disabled} onChange={event => onCurrencyChange(event.target.value.toUpperCase())} placeholder="Not read" autoCapitalize="characters" />
          <p className="text-[11px] text-muted-foreground">Defaults to AUD. No currency conversion is applied.</p>
        </div>
      </div>
      {!isAud ? (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
          ScopeClear records job costs in AUD and does not convert currencies. This receipt is not currently confirmed as AUD. Verify the amount in AUD yourself before changing the currency and continuing; do not treat a foreign-currency total as AUD.
        </p>
      ) : (
        <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
          <input
            data-testid="checkbox-receipt-currency-aud"
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-amber-700"
            checked={currencyConfirmed}
            disabled={disabled}
            onChange={event => onCurrencyConfirmedChange(event.target.checked)}
          />
          <span>I confirm these receipt amounts are in Australian dollars. No currency conversion is applied.</span>
        </label>
      )}
    </div>
  );
}
