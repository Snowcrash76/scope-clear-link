import type { QuoteLineItem, ScopeItem } from '@/types/project';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function VariationQuoteItemSelect({ value, onChange, scopeItems, quoteItems = [] }: {
  value: string; onChange: (value: string) => void; scopeItems: ScopeItem[]; quoteItems?: QuoteLineItem[];
}) {
  return <div className="space-y-2">
    <Label>Related Quote Item (optional)</Label>
    <Select value={value || 'none'} onValueChange={onChange}>
      <SelectTrigger aria-label="Related quote item"><SelectValue placeholder="Select a quote item..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {scopeItems.filter(item => item.category === 'included').map(item =>
          <SelectItem key={item.id} value={`scope:${item.id}`}>{item.title} (included work)</SelectItem>)}
        {quoteItems.filter(item => !item.isVariation).map(item =>
          <SelectItem key={item.id} value={`quote:${item.id}`}>{item.title}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
