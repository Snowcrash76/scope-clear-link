import type { ReceiptLineItem } from '@/hooks/useJobCosts';

type ReceiptItemsSummaryProps = {
  items: ReceiptLineItem[];
  subtotal: number | null;
  gst: number | null;
  total: number | null;
  compact?: boolean;
};

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
});

const amountText = (value: number | null) => value === null ? 'Not read' : aud.format(value);
const detailText = (value: number | null) => value === null ? 'Not read' : String(value);

export function ReceiptItemsSummary({
  items,
  subtotal,
  gst,
  total,
  compact = false,
}: ReceiptItemsSummaryProps) {
  return (
    <section
      className={`min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-background ${compact ? 'text-xs' : 'text-sm'}`}
      aria-label="Receipt item and totals summary"
      data-testid="receipt-items-summary"
    >
      <div className="border-b border-border bg-muted/30 px-3 py-2">
        <h3 className="font-semibold text-foreground">Line items</h3>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-muted-foreground" data-testid="receipt-summary-empty">No item details recorded.</p>
      ) : (
        <ol className="divide-y divide-border" aria-label="Receipt line items">
          {items.map((item, index) => (
            <li key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-2.5" data-testid={`receipt-summary-line-${index}`}>
              <div className="min-w-0">
                <p className="break-words font-medium leading-snug text-foreground" data-testid={`receipt-summary-description-${index}`}>
                  {item.description?.trim() || 'Description not read'}
                </p>
                <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground" data-testid={`receipt-summary-details-${index}`}>
                  <span>Qty {detailText(item.quantity)}</span>
                  <span aria-hidden="true"> · </span>
                  <span>Unit {item.unit_price === null ? 'Not read' : amountText(item.unit_price)}</span>
                </p>
              </div>
              <p className="whitespace-nowrap text-right font-semibold tabular-nums text-foreground" data-testid={`receipt-summary-amount-${index}`}>
                {amountText(item.amount)}
              </p>
            </li>
          ))}
        </ol>
      )}
      <dl className="space-y-0 border-t border-border bg-muted/20 px-3 py-2">
        <div className="flex min-w-0 items-baseline justify-between gap-3 py-1">
          <dt className="text-muted-foreground">Ex GST</dt>
          <dd className="shrink-0 text-right tabular-nums text-foreground" data-testid="receipt-summary-subtotal">{amountText(subtotal)}</dd>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-3 py-1">
          <dt className="text-muted-foreground">GST</dt>
          <dd className="shrink-0 text-right tabular-nums text-foreground" data-testid="receipt-summary-gst">{amountText(gst)}</dd>
        </div>
        <div className="mt-1 flex min-w-0 items-baseline justify-between gap-3 border-t border-border pt-2">
          <dt className="font-semibold text-foreground">Total AUD</dt>
          <dd className="shrink-0 text-right font-semibold tabular-nums text-foreground" data-testid="receipt-summary-total">{amountText(total)}</dd>
        </div>
      </dl>
    </section>
  );
}
