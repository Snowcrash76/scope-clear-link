import { describe, expect, test } from 'bun:test';
import { generateInvoicePDF } from '../src/lib/invoicePdf';
import { generateQuotePDF } from '../src/lib/quotePdf';
import type { Invoice, Quote, QuoteLineItem } from '../src/types/project';

const createdAt = new Date('2026-11-01T00:00:00Z');
const project = {
  name: 'PDF compatibility test',
  clientName: 'Sample Client',
  clientEmail: 'sample@example.com',
  tradeBusinessName: 'Sample Business',
};
const quote: Quote = {
  id: 'quote-pdf-test', projectId: 'project-pdf-test', quoteNumber: 'QT-PDF-TEST',
  status: 'draft', subtotal: 27100, taxRate: 10, taxAmount: 2710, total: 29810,
  createdAt, updatedAt: createdAt,
};
const lineItem: QuoteLineItem = {
  id: 'quote-line-test', quoteId: quote.id, title: 'Sample materials',
  description: 'Plain text PDF compatibility check', cost: quote.subtotal,
  sortOrder: 0, isVariation: false, createdAt, updatedAt: createdAt,
};
const invoice: Invoice = {
  id: 'invoice-pdf-test', projectId: quote.projectId, quoteId: quote.id,
  invoiceNumber: 'INV-PDF-TEST', type: 'deposit', status: 'draft',
  subtotal: 1355, taxRate: 10, taxAmount: 135.5, total: 1490.5, amountPaid: 0,
  createdAt, updatedAt: createdAt,
  lineItems: [{
    id: 'invoice-line-test', invoiceId: 'invoice-pdf-test', description: 'Deposit payment',
    quantity: 1, unitPrice: 1355, total: 1355, createdAt,
  }],
};

describe('PDF generation compatibility', () => {
  test('quote creates a valid PDF with line items and the GST-inclusive total', () => {
    const doc = generateQuotePDF(quote, project, [], [], [lineItem]);
    const pdf = doc.output();
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
    expect(pdf).toContain('QT-PDF-TEST');
    expect(pdf).toContain('Sample materials');
    expect(pdf).toContain('29,810.00');
  });

  test('deposit invoice creates a valid PDF with line items and the correct total', () => {
    const doc = generateInvoicePDF(invoice, project);
    const pdf = doc.output();
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
    expect(pdf).toContain('INV-PDF-TEST');
    expect(pdf).toContain('Deposit payment');
    expect(pdf).toContain('1,490.50');
  });
});
