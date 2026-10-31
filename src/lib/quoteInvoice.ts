import type { Quote } from '@/types/project';

export interface QuoteInvoiceAllocation {
  type: 'final' | 'deposit' | 'staged';
  percentage: number;
  description?: string;
}

export interface QuoteInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  scopeItemId?: string;
  changeRequestId?: string;
}

const money = (value: number) => Math.round(value * 100 + 1e-8) / 100;

/** Percentages always refer to the saved quote subtotal, never today's scope. */
export function calculateQuoteInvoiceAmounts(subtotal: number, taxRate: number, percentage: number) {
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    throw new Error('The saved quote must have a positive amount before creating an invoice.');
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new Error('The quote GST rate is invalid.');
  }
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100
    || Math.abs(percentage * 100 - Math.round(percentage * 100)) > 1e-7) {
    throw new Error('Enter a percentage greater than 0 and no more than 100, with up to two decimal places.');
  }
  const allocatedSubtotal = money(subtotal * percentage / 100);
  if (allocatedSubtotal <= 0) throw new Error('This percentage produces an amount below one cent.');
  const taxAmount = money(allocatedSubtotal * taxRate / 100);
  return { subtotal: allocatedSubtotal, taxAmount, total: money(allocatedSubtotal + taxAmount) };
}

export function buildQuoteInvoice(
  quote: Quote,
  allocation: QuoteInvoiceAllocation = { type: 'final', percentage: 100 },
  fullLineItems: QuoteInvoiceLine[] = [],
) {
  if (!['final', 'deposit', 'staged'].includes(allocation.type)) throw new Error('Choose a valid invoice type.');
  if (allocation.type === 'final' && allocation.percentage !== 100) {
    throw new Error('A full invoice must use 100% of the quote.');
  }
  const amounts = calculateQuoteInvoiceAmounts(quote.subtotal, quote.taxRate, allocation.percentage);
  const label = allocation.type === 'deposit' ? 'Deposit' : allocation.type === 'staged' ? 'Stage payment' : 'Full payment';
  const description = `${label} – ${allocation.percentage}% of quote ${quote.quoteNumber}${allocation.description?.trim() ? `: ${allocation.description.trim()}` : ''}`;
  // Preserve itemisation for full invoices when it reconciles to the saved quote.
  // Never silently invoice a different amount if the current scope has changed.
  const fullItemsMatch = fullLineItems.length > 0
    && fullLineItems.every(item => Number.isFinite(item.quantity) && Number.isFinite(item.unitPrice))
    && money(fullLineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)) === amounts.subtotal;
  return {
    type: allocation.type,
    quoteId: quote.id,
    taxRate: quote.taxRate,
    notes: quote.notes,
    terms: quote.terms,
    lineItems: allocation.type === 'final' && fullItemsMatch && !allocation.description?.trim()
      ? fullLineItems
      : [{ description, quantity: 1, unitPrice: amounts.subtotal }],
  };
}
