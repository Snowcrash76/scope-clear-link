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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div><Label>Receipt line items</Label><p className="text-[11px] text-muted-foreground">Check each value against the original.</p></div>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...items, { description: '', quantity: null, unit_price: null, amount: null }])}><Plus className="mr-1.5 h-3.5 w-3.5" />Add row</Button>
      </div>
      {items.length === 0 ? <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No line items were read. Add rows if they are useful for this record.</p> : items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[minmax(0,2fr)_minmax(5rem,.7fr)_minmax(6rem,.9fr)_minmax(6rem,.9fr)_auto] sm:items-end">
          <div className="space-y-1"><Label htmlFor={`receipt-line-description-${index}`} className="text-xs">Description</Label><Input id={`receipt-line-description-${index}`} value={item.description} maxLength={2000} disabled={disabled} onChange={event => update(index, 'description', event.target.value)} placeholder="Item or service" /></div>
          <div className="space-y-1"><Label htmlFor={`receipt-line-quantity-${index}`} className="text-xs">Qty</Label><Input id={`receipt-line-quantity-${index}`} type="number" step="any" disabled={disabled} value={display(item.quantity)} onChange={event => update(index, 'quantity', event.target.value)} placeholder="—" /></div>
          <div className="space-y-1"><Label htmlFor={`receipt-line-unit-${index}`} className="text-xs">Unit price</Label><Input id={`receipt-line-unit-${index}`} type="number" step="0.01" disabled={disabled} value={display(item.unit_price)} onChange={event => update(index, 'unit_price', event.target.value)} placeholder="—" /></div>
          <div className="space-y-1"><Label htmlFor={`receipt-line-amount-${index}`} className="text-xs">Amount</Label><Input id={`receipt-line-amount-${index}`} type="number" step="0.01" disabled={disabled} value={display(item.amount)} onChange={event => update(index, 'amount', event.target.value)} placeholder="Unreadable" /></div>
          <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove receipt line ${index + 1}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
    </div>
  );
}
