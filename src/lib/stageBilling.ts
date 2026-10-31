import type { Invoice, ProjectStage, Quote } from '@/types/project';
import { calculateQuoteInvoiceAmounts } from '@/lib/quoteInvoice';

const cents = (value: number) => Math.round(value * 100 + 1e-8) / 100;

/** A cancelled invoice stays in history but no longer reserves the stage. */
export function activeStageInvoice(invoices: Invoice[], stageId: string): Invoice | undefined {
  return invoices.find(invoice => invoice.stageId === stageId && invoice.status !== 'cancelled');
}

/** Only the persisted active quote is a billing basis; never recompute from the current scope. */
export function getStageBilling(stage: ProjectStage, quote: Quote | null) {
  const taxRate = quote?.taxRate ?? 10;
  let subtotal: number;
  let allocationLabel: string;
  if (stage.invoiceAmount != null) {
    if (!Number.isFinite(stage.invoiceAmount) || stage.invoiceAmount <= 0 ||
      Math.abs(stage.invoiceAmount * 100 - Math.round(stage.invoiceAmount * 100)) > 1e-7) {
      throw new Error('This stage has an invalid fixed invoice amount. Edit the stage before invoicing.');
    }
    subtotal = cents(stage.invoiceAmount);
    allocationLabel = 'Fixed stage amount';
  } else if (stage.invoicePercentage != null) {
    if (!quote) throw new Error('Save a quote with a valid amount before invoicing this percentage stage.');
    if (!Number.isFinite(quote.taxRate) || quote.taxRate < 0 || quote.taxRate > 100) {
      throw new Error('This quote has an invalid GST rate. Check the quote before invoicing.');
    }
    const base = quote.subtotal > 0 ? quote.subtotal :
      quote.total > 0 ? quote.total / (1 + quote.taxRate / 100) : 0;
    if (!Number.isFinite(base) || base <= 0) {
      throw new Error('The saved quote amount is unavailable. Check the quote before invoicing this stage.');
    }
    subtotal = calculateQuoteInvoiceAmounts(base, quote.taxRate, stage.invoicePercentage).subtotal;
    allocationLabel = `${stage.invoicePercentage}% of quote`;
  } else {
    throw new Error('Add an invoice percentage or fixed amount to this stage first.');
  }
  const amounts = calculateQuoteInvoiceAmounts(subtotal, taxRate, 100);
  return {
    ...amounts,
    taxRate,
    allocationLabel,
    quoteNumber: quote?.quoteNumber ?? null,
    description: `Stage Payment: ${stage.name} (${allocationLabel}${quote ? ` ${quote.quoteNumber}` : ''})`,
  };
}
