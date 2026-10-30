import { RichTextContent } from '@/components/RichTextEditor';
import { Button } from '@/components/ui/button';
import { cn, cleanVariationTitle, stripVariationMeta } from '@/lib/utils';
import type { ChangeRequest, QuoteLineItem, ScopeItem } from '@/types/project';
import { formatHistoryEntry, type LineItemHistoryEntry } from '@/hooks/useLineItemHistory';
import { aud } from '@/hooks/useJobCosts';
import { Clock, Pencil, Plus } from 'lucide-react';

type QuoteLineItemsTableProps = {
  includedItems: ScopeItem[];
  baseQuoteLineItems: QuoteLineItem[];
  approvedChanges: ChangeRequest[];
  variationLineItems: QuoteLineItem[];
  lineItemHistory: LineItemHistoryEntry[];
  scopeSubtotal: number;
  customItemsTotal: number;
  changesImpact: number;
  isTradeView: boolean;
  canEditScopeItems: boolean;
  expandedHistoryItemId: string | null;
  onAddIncludedItem: () => void;
  onEditScopeItem: (item: ScopeItem) => void;
  onToggleHistoryItem: (itemId: string) => void;
};

function HistoryRows({ entries }: { entries: LineItemHistoryEntry[] }) {
  return (
    <div className="mt-2 space-y-1 border-t border-dashed pt-2">
      {entries.map(entry => (
        <div key={entry.id} className="flex items-start gap-2 text-xs text-muted-foreground">
          <Clock className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-60" />
          <div className="min-w-0 flex-1">
            <span>{formatHistoryEntry(entry)}</span>
            <span className="ml-2 opacity-60">
              {entry.createdAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' '}
              {entry.createdAt.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuoteLineItemsTable({
  includedItems,
  baseQuoteLineItems,
  approvedChanges,
  variationLineItems,
  lineItemHistory,
  scopeSubtotal,
  customItemsTotal,
  changesImpact,
  isTradeView,
  canEditScopeItems,
  expandedHistoryItemId,
  onAddIncludedItem,
  onEditScopeItem,
  onToggleHistoryItem,
}: QuoteLineItemsTableProps) {
  return (
    <>
      {(includedItems.length > 0 || baseQuoteLineItems.length > 0 || canEditScopeItems) && (
        <div className="mb-4 divide-y rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-sm font-semibold">Included items</span>
              <span className="text-sm text-muted-foreground">
                Subtotal <span className="text-xs">ex GST</span>: <span className="tabular-nums font-semibold text-foreground">{aud(scopeSubtotal + customItemsTotal)}</span>
              </span>
            </div>
            {canEditScopeItems && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={onAddIncludedItem}
                data-testid="button-add-scope-item-read"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add item
              </Button>
            )}
          </div>
          {includedItems.map(item => (
            <div key={item.id} className="flex flex-col items-start justify-between gap-2 p-3 sm:flex-row">
              <div className="w-full min-w-0 sm:flex-1 sm:pr-4">
                <span className="break-words text-sm font-medium [overflow-wrap:anywhere]">{cleanVariationTitle(item.title)}</span>
                {stripVariationMeta(item.description) && (
                  <RichTextContent html={stripVariationMeta(item.description)} className="mt-1 max-w-[75ch] break-words text-sm leading-6 [overflow-wrap:anywhere]" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-sm font-medium">{aud(item.cost || 0)}</span>
                {canEditScopeItems && (
                  <button
                    type="button"
                    onClick={() => onEditScopeItem(item)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
                    data-testid={`button-edit-scope-item-read-${item.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {baseQuoteLineItems.map(item => {
            const itemHistory = lineItemHistory.filter(entry => entry.lineItemId === item.id);
            const hasHistory = itemHistory.length > 0;
            const isExpanded = expandedHistoryItemId === item.id;
            return (
              <div key={item.id} className="p-3">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                  <div className="w-full min-w-0 sm:flex-1 sm:pr-2">
                    <span className="break-words text-sm font-medium [overflow-wrap:anywhere]">{cleanVariationTitle(item.title)}</span>
                    {stripVariationMeta(item.description) && (
                      <RichTextContent html={stripVariationMeta(item.description)} className="mt-1 max-w-[75ch] break-words text-sm leading-6 [overflow-wrap:anywhere]" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="whitespace-nowrap text-sm font-medium">{aud(item.cost || 0)}</span>
                    {hasHistory && isTradeView && (
                      <button
                        type="button"
                        onClick={() => onToggleHistoryItem(item.id)}
                        className={cn(
                          'rounded p-1 transition-colors',
                          isExpanded
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        title="View change history"
                        data-testid={`button-item-history-${item.id}`}
                      >
                        <Clock className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && <HistoryRows entries={itemHistory} />}
              </div>
            );
          })}
        </div>
      )}

      {(approvedChanges.length > 0 || variationLineItems.length > 0) && (
        <div className="mb-6 divide-y rounded-lg border border-approved/30 bg-approved/5">
          <div className="border-b border-approved/20 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-approved">Approved Variations</span>
              <span className="tabular-nums text-sm font-semibold text-approved">Subtotal {aud(changesImpact)}</span>
            </div>
          </div>
          {approvedChanges.map(change => (
            <div key={change.id} className="flex flex-col items-start justify-between gap-2 p-3 sm:flex-row">
              <div className="w-full min-w-0 sm:flex-1 sm:pr-4">
                <span className="break-words text-sm font-medium [overflow-wrap:anywhere]">{change.title}</span>
                {stripVariationMeta(change.description) && (
                  <RichTextContent html={stripVariationMeta(change.description)} className="mt-1 max-w-[75ch] break-words text-sm leading-6 [overflow-wrap:anywhere]" />
                )}
              </div>
              <span className={cn(
                'whitespace-nowrap text-sm font-medium',
                change.costImpact > 0 ? 'text-approved' : change.costImpact < 0 ? 'text-destructive' : '',
              )}>
                {change.costImpact > 0 ? '+' : ''}{aud(change.costImpact)}
              </span>
            </div>
          ))}
          {variationLineItems.map(item => {
            const itemHistory = lineItemHistory.filter(entry => entry.lineItemId === item.id);
            const isExpanded = expandedHistoryItemId === item.id;
            return (
              <div key={item.id} className="p-3">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                  <div className="w-full min-w-0 sm:flex-1 sm:pr-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="break-words text-sm font-medium [overflow-wrap:anywhere]">{item.title}</span>
                      {itemHistory.length > 0 && isTradeView && (
                        <button
                          type="button"
                          onClick={() => onToggleHistoryItem(item.id)}
                          className={cn(
                            'rounded p-1 transition-colors',
                            isExpanded
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                          title="View change history"
                          data-testid={`button-item-history-${item.id}`}
                        >
                          <Clock className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {item.description && (
                      <RichTextContent html={item.description} className="mt-1 max-w-[75ch] break-words text-sm leading-6 [overflow-wrap:anywhere]" />
                    )}
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium text-approved">+{aud(item.cost || 0)}</span>
                </div>
                {isExpanded && <HistoryRows entries={itemHistory} />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
