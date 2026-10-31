export interface InvoiceEditInput {
  invoiceNumber: string;
  dueDate?: string;
  notes: string;
  terms: string;
  taxRate: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    scopeItemId?: string;
    changeRequestId?: string;
  }>;
}

export const invoiceStatusLabel = (status: string): string => ({
  draft: 'Pending approval', approved: 'Approved', sent: 'Sent', paid: 'Paid',
  overdue: 'Overdue', cancelled: 'Cancelled',
}[status] ?? status);

/** Approval is persisted independently of delivery; legacy drafts remain compatible. */
export function invoiceDisplayStatus(status: string, approvedAt?: string | null) {
  return status === 'draft' && approvedAt ? 'approved' : status;
}

const cents = (value: number) => Math.round(value * 100 + 1e-8) / 100;

export function calculateEditableInvoice(input: InvoiceEditInput) {
  if (!input.invoiceNumber.trim() || input.invoiceNumber.length > 120) {
    throw new Error('Enter an invoice reference of up to 120 characters.');
  }
  if (!Number.isFinite(input.taxRate) || input.taxRate < 0 || input.taxRate > 100) {
    throw new Error('GST must be between 0% and 100%.');
  }
  if (input.dueDate) {
    const parsed = new Date(`${input.dueDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== input.dueDate) throw new Error('Enter a valid due date.');
  }
  if (input.notes.length > 50000 || input.terms.length > 50000) {
    throw new Error('Notes and terms must each be fewer than 50,000 characters.');
  }
  if (!input.lineItems.length || input.lineItems.length > 200) {
    throw new Error('Include between 1 and 200 invoice line items.');
  }
  const lineItems = input.lineItems.map(item => {
    if (!item.description.replace(/<[^>]*>/g, '').trim() || item.description.length > 10000) {
      throw new Error('Each line item needs a description of up to 10,000 characters.');
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1e6 ||
      !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 1e9) {
      throw new Error('Line quantities must be positive and prices cannot be negative.');
    }
    return { ...item, total: cents(item.quantity * item.unitPrice) };
  });
  const subtotal = cents(lineItems.reduce((sum, item) => sum + item.total, 0));
  if (subtotal <= 0 || subtotal > 1e12) throw new Error('The invoice subtotal must be greater than zero and no more than $1 trillion.');
  const taxAmount = cents(subtotal * input.taxRate / 100);
  return { lineItems, subtotal, taxAmount, total: cents(subtotal + taxAmount) };
}
