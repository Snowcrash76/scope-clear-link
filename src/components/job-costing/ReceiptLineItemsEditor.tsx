import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ReceiptLineItem } from '@/hooks/useJobCosts';

type ReceiptLineItemsEditorProps = {
  items: ReceiptLineItem[];
  onChange: (items: ReceiptLineItem[]) => void;
  disabled?: boolean;
};

const display = (value: number | null) => value === null ? '' : String(value);
const parseNullable = (value: string) => value.trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export function ReceiptLineItemsEditor({ items, onChange, disabled = false }: ReceiptLineItemsEditorProps) {
  const update = (index: number, key: keyof ReceiptLineItem, value: string) => {
    onChange(items.map((item, itemIndex) => itemIndex !== index ? item : {
      ...item,
      [key]: key === 'description' ? value : parseNullable(value),
    }));
  };
  return (
    <section className="min-w-0 max-w-full space-y-3" aria-labelledby="receipt-line-items-heading" data-testid="receipt-line-items-editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 id="receipt-line-items-heading" className="text-sm font-semibold text-foreground">Receipt line items</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Check each value against the original receipt.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...items, { description: '', quantity: null, unit_price: null, amount: null }])}
          data-testid="receipt-line-item-add"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Add row
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm leading-relaxed text-muted-foreground" data-testid="receipt-line-items-empty">
          No line items were read. Add rows if they are useful for this record.
        </p>
      ) : (
        <ol className="min-w-0 space-y-2" aria-label="Editable receipt line items">
          {items.map((item, index) => (
            <li
              key={index}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-3 rounded-lg border border-border bg-background p-3 shadow-sm shadow-foreground/[0.025] sm:grid-cols-[minmax(0,1fr)_auto]"
              data-testid={`receipt-line-item-${index}`}
            >
              <div className="col-span-2 flex min-w-0 items-start gap-2 sm:col-span-1">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor={`receipt-line-description-${index}`} className="text-sm text-muted-foreground">Product / description</Label>
                  <Input
                    id={`receipt-line-description-${index}`}
                    value={item.description ?? ''}
                    maxLength={2000}
                    disabled={disabled}
                    onChange={event => update(index, 'description', event.target.value)}
                    placeholder="Description not read"
                    className="min-h-11 min-w-0 text-sm"
                    data-testid={`receipt-line-description-${index}`}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-start-2 row-start-1 h-9 w-9 text-muted-foreground hover:text-destructive sm:col-start-2"
                disabled={disabled}
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`Remove receipt line ${index + 1}${item.description ? `: ${item.description}` : ''}`}
                data-testid={`receipt-line-remove-${index}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-3">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`receipt-line-quantity-${index}`} className="text-sm text-muted-foreground">Quantity</Label>
                  <Input
                    id={`receipt-line-quantity-${index}`}
                    type="number"
                    step="any"
                    disabled={disabled}
                    value={display(item.quantity)}
                    onChange={event => update(index, 'quantity', event.target.value)}
                    placeholder="Not read"
                    className="min-h-11 text-sm"
                    data-testid={`receipt-line-quantity-${index}`}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`receipt-line-unit-${index}`} className="text-sm text-muted-foreground">Unit price</Label>
                  <Input
                    id={`receipt-line-unit-${index}`}
                    type="number"
                    step="0.01"
                    disabled={disabled}
                    value={display(item.unit_price)}
                    onChange={event => update(index, 'unit_price', event.target.value)}
                    placeholder="Not read"
                    className="min-h-11 text-sm"
                    data-testid={`receipt-line-unit-price-${index}`}
                  />
                </div>
                <div className="col-span-2 min-w-0 space-y-1 sm:col-span-1">
                  <Label htmlFor={`receipt-line-amount-${index}`} className="text-sm text-muted-foreground">Line total</Label>
                  <Input
                    id={`receipt-line-amount-${index}`}
                    type="number"
                    step="0.01"
                    disabled={disabled}
                    value={display(item.amount)}
                    onChange={event => update(index, 'amount', event.target.value)}
                    placeholder="Not read"
                    className="min-h-11 text-sm"
                    data-testid={`receipt-line-amount-${index}`}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
