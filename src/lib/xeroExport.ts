import { Invoice, Quote, ScopeItem, ChangeRequest, InvoiceLineItem } from '@/types/project';
import { format } from 'date-fns';

interface ProjectInfo {
  clientName: string;
  clientEmail: string;
}

// Determine Xero tax type based on tax rate
function getXeroTaxType(taxRate: number): string {
  if (taxRate === 10) return 'GST on Income';
  if (taxRate === 0) return 'BAS Excluded';
  return 'GST on Income'; // Default for Australian GST
}

// Format date for Xero (YYYY-MM-DD)
function formatXeroDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// Escape CSV field (handle commas, quotes, newlines)
function escapeCSVField(field: string | number | undefined | null): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  // If the field contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Generate CSV row
function createCSVRow(fields: (string | number | undefined | null)[]): string {
  return fields.map(escapeCSVField).join(',');
}

/**
 * Export an invoice to Xero-compatible CSV format
 */
export function exportInvoiceToXeroCSV(
  invoice: Invoice,
  project: ProjectInfo,
  accountCode: string = '200' // Default sales revenue account
): string {
  const headers = [
    '*ContactName',
    'EmailAddress',
    '*InvoiceNumber',
    '*InvoiceDate',
    '*DueDate',
    'Description',
    'Quantity',
    'UnitAmount',
    'AccountCode',
    '*TaxType'
  ];

  const rows: string[] = [createCSVRow(headers)];

  const invoiceDate = formatXeroDate(invoice.createdAt);
  const dueDate = invoice.dueDate 
    ? formatXeroDate(invoice.dueDate) 
    : formatXeroDate(new Date(invoice.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000)); // Default 14 days
  const taxType = getXeroTaxType(invoice.taxRate);

  // Add line items
  invoice.lineItems.forEach(item => {
    rows.push(createCSVRow([
      project.clientName,
      project.clientEmail,
      invoice.invoiceNumber,
      invoiceDate,
      dueDate,
      item.description,
      item.quantity,
      item.unitPrice.toFixed(2),
      accountCode,
      taxType
    ]));
  });

  // If no line items, add a single row with the total
  if (invoice.lineItems.length === 0) {
    rows.push(createCSVRow([
      project.clientName,
      project.clientEmail,
      invoice.invoiceNumber,
      invoiceDate,
      dueDate,
      invoice.type === 'final' ? 'Final Payment' : 'Progress Payment',
      1,
      invoice.subtotal.toFixed(2),
      accountCode,
      taxType
    ]));
  }

  return rows.join('\n');
}

/**
 * Export a quote to Xero-compatible CSV format
 */
export function exportQuoteToXeroCSV(
  quote: Quote,
  project: ProjectInfo,
  scopeItems: ScopeItem[],
  changeRequests: ChangeRequest[]
): string {
  const headers = [
    '*ContactName',
    'EmailAddress',
    '*QuoteNumber',
    '*Date',
    '*ExpiryDate',
    'Description',
    'Quantity',
    'UnitAmount',
    '*TaxType'
  ];

  const rows: string[] = [createCSVRow(headers)];

  const quoteDate = formatXeroDate(quote.createdAt);
  const expiryDate = quote.validUntil 
    ? formatXeroDate(quote.validUntil) 
    : formatXeroDate(new Date(quote.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)); // Default 30 days
  const taxType = getXeroTaxType(quote.taxRate);

  // Add included scope items as line items
  const includedItems = scopeItems.filter(item => item.category === 'included');
  includedItems.forEach(item => {
    rows.push(createCSVRow([
      project.clientName,
      project.clientEmail,
      quote.quoteNumber,
      quoteDate,
      expiryDate,
      item.title,
      1,
      (item.cost || 0).toFixed(2),
      taxType
    ]));
  });

  // Add approved change requests
  const approvedChanges = changeRequests.filter(cr => cr.status === 'approved');
  approvedChanges.forEach(change => {
    rows.push(createCSVRow([
      project.clientName,
      project.clientEmail,
      quote.quoteNumber,
      quoteDate,
      expiryDate,
      `Variation: ${change.title}`,
      1,
      change.costImpact.toFixed(2),
      taxType
    ]));
  });

  return rows.join('\n');
}

/**
 * Trigger a CSV file download in the browser
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
