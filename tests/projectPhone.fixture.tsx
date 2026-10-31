// Isolated real-component fixture; bundled only into ignored generated-artifacts.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JobSectionMenu } from '../src/components/JobSectionMenu';
import { QuoteSection } from '../src/components/QuoteSection';
import { InvoiceSection } from '../src/components/InvoiceSection';
import type { Invoice, Quote, QuoteLineItem } from '../src/types/project';

const longText = 'LongUnbrokenProjectReference'.repeat(8);
const date = new Date('2026-10-28T12:00:00Z');
const quote: Quote = {
  id: 'phone-quote', projectId: 'phone-project', quoteNumber: longText,
  status: 'approved', subtotal: 1200, taxRate: 10, taxAmount: 120, total: 1320,
  createdAt: date, updatedAt: date,
};
const invoice: Invoice = {
  id: 'phone-invoice', projectId: 'phone-project', invoiceNumber: longText,
  type: 'staged', status: 'draft', subtotal: 1200, taxRate: 10, taxAmount: 120,
  total: 1320, amountPaid: 0, createdAt: date, updatedAt: date, dueDate: date,
  notes: `<p>${longText}</p>`, terms: `<pre>${longText}</pre>`,
  lineItems: [{
    id: 'invoice-line', invoiceId: 'phone-invoice', description: longText,
    quantity: 1, unitPrice: 1200, total: 1200, createdAt: date,
  }],
};
const item: QuoteLineItem = {
  id: 'phone-item', quoteId: quote.id, title: longText, description: longText,
  cost: 1200, sortOrder: 0, isVariation: false, createdAt: date, updatedAt: date,
};
const success = async () => true;

function Fixture() {
  const [section, setSection] = useState('quote');
  const [items, setItems] = useState([item]);
  return <main className="mx-auto w-full min-w-0 max-w-6xl space-y-5 px-4 py-6">
    <JobSectionMenu value={section} onValueChange={setSection}
      invoiceCount={12} pendingVariationCount={23} documentCount={42} stageCount={5} />
    {section === 'quote' && <QuoteSection quote={quote} scopeItems={[]} changeRequests={[]}
      quoteLineItems={items} projectName={longText} clientName={longText}
      onAddLineItem={async data => {
        setItems(current => [...current, { ...item, ...data, id: 'added-item' }]);
        return 'added-item';
      }}
      onUpdateLineItem={async (id, data) => {
        setItems(current => current.map(row => row.id === id ? { ...row, ...data } : row));
        return true;
      }}
      onDeleteLineItem={async id => { setItems(current => current.filter(row => row.id !== id)); return true; }}
      onCreateQuote={async () => quote.id} onUpdateQuote={success} onSendQuote={success}
      onApproveQuote={success} onCreateInvoice={success} onReviseQuote={success} />}
    {section === 'invoices' && <InvoiceSection invoices={[invoice]} quote={quote}
      scopeItems={[]} changeRequests={[]} quoteLineItems={items}
      projectName={longText} clientName={longText} clientEmail={`${longText}@example.invalid`}
      defaultTerms={`<p>${longText}</p>`} defaultPaymentInstructions={`<p>${longText}</p>`}
      onCreateInvoice={async data => {
        (window as Window & { savedInvoice?: unknown }).savedInvoice = data;
        return 'created-invoice';
      }} onUpdateInvoiceNumber={success} onSendInvoice={success} onMarkAsPaid={success}
      onCancelInvoice={success} onDeleteInvoice={success} />}
    {!['quote', 'invoices'].includes(section) && <p>{section}</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
