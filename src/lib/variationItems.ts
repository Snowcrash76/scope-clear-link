import type { ChangeRequest, QuoteLineItem, ScopeItem } from '@/types/project';

export function variationItemLinks(value: string) {
  return {
    relatedScopeItemId: value.startsWith('scope:') ? value.slice(6) : '',
    relatedQuoteLineItemId: value.startsWith('quote:') ? value.slice(6) : '',
  };
}

export function variationItemValue(request: Pick<ChangeRequest, 'relatedScopeItemId' | 'relatedQuoteLineItemId'>) {
  return request.relatedScopeItemId ? `scope:${request.relatedScopeItemId}`
    : request.relatedQuoteLineItemId ? `quote:${request.relatedQuoteLineItemId}` : 'none';
}

export function variationItemTitle(request: ChangeRequest, scopeItems: ScopeItem[], quoteItems: QuoteLineItem[]) {
  return scopeItems.find(item => item.id === request.relatedScopeItemId)?.title
    ?? quoteItems.find(item => item.id === request.relatedQuoteLineItemId)?.title;
}
