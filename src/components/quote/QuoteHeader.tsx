import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Quote } from '@/types/project';
import { format } from 'date-fns';
import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FileText } from 'lucide-react';

type QuoteHeaderProps = {
  quote: Quote;
  config: {
    label: string;
    variant: ComponentProps<typeof Badge>['variant'];
    icon: LucideIcon;
  };
  isTradeView: boolean;
  quoteRef: string;
  onQuoteRefChange: (value: string) => void;
  onSaveReference: () => Promise<boolean | undefined>;
  isSavingReference: boolean;
};

export function QuoteHeader({
  quote,
  config,
  isTradeView,
  quoteRef,
  onQuoteRefChange,
  onSaveReference,
  isSavingReference,
}: QuoteHeaderProps) {
  const StatusIcon = config.icon;

  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <div className="rounded-lg bg-primary/10 p-2">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-col gap-0.5">
            <h3 className="break-words font-heading font-semibold [overflow-wrap:anywhere]">{quote.quoteNumber}</h3>
            {isTradeView ? (
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <Label htmlFor="quote-reference-field" className="sr-only">Quote reference</Label>
                <Input
                  id="quote-reference-field"
                  value={quoteRef}
                  onChange={event => onQuoteRefChange(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') void onSaveReference(); }}
                  className="h-10 w-full max-w-sm text-sm"
                  placeholder="Add reference"
                  data-testid="input-quote-reference"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10"
                  onClick={() => void onSaveReference()}
                  disabled={isSavingReference || quoteRef.trim() === (quote.reference ?? '')}
                  data-testid="button-save-quote-reference"
                >
                  {isSavingReference ? 'Saving…' : 'Save reference'}
                </Button>
              </div>
            ) : (
              quote.reference && <p className="mt-1 min-w-0 break-words text-sm text-muted-foreground">{quote.reference}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Created {format(quote.createdAt, 'dd MMM yyyy')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <Badge variant={config.variant} className="gap-1.5">
          <StatusIcon className="h-3.5 w-3.5" />
          {config.label}
        </Badge>
      </div>
    </div>
  );
}
