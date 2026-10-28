// Bundled only into ignored generated-artifacts by mobileLayout.browser.mjs.
// Uses real form components and isolated synthetic service responses; no auth or database.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { JobCostsTab } from '../src/components/job-costing/JobCostsTab';
import { ReceiptItemsSummary } from '../src/components/job-costing/ReceiptItemsSummary';

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-background">
    <header className="border-b p-4 font-bold">ScopeClear — receipt layout test</header>
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6">
      {new URLSearchParams(location.search).get('view') === 'itemised' ? (
        <ReceiptItemsSummary items={[
          { description: 'ULTRASET TIMBER FLOOR ADHESIVE', quantity: 1, unit_price: 10.575, amount: 10.58 },
          { description: 'STAR STEEL POST 600MM', quantity: 1, unit_price: 6.29, amount: 6.29 },
          { description: 'NOZZLE FOR PRO-SAUSAGE 600ML', quantity: 2, unit_price: 0.99, amount: 1.98 },
        ]} subtotal={17.14} gst={1.71} total={18.85} />
      ) : <JobCostsTab jobId="00000000-0000-4000-8000-000000000001" />}
    </main>
  </div>,
);
