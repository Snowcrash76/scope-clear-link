import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JobSectionMenu } from '../src/components/JobSectionMenu';
import { Tabs, TabsContent } from '../src/components/ui/tabs';

const sections = [
  ['quote', 'Quote'], ['invoices', 'Invoices'], ['costs', 'Costs'],
  ['changes', 'Variations'], ['stages', 'Stages'], ['documents', 'Documents'],
];
function Fixture() {
  const [value, setValue] = useState(new URLSearchParams(location.search).get('tab') || 'quote');
  return <main className="mx-auto max-w-5xl p-4">
    <h1 className="mb-1 text-xl font-bold">Example job</h1>
    <p className="mb-6 text-sm text-muted-foreground">Isolated job-section navigation check</p>
    <Tabs value={value} onValueChange={setValue} className="min-w-0">
      <JobSectionMenu value={value} onValueChange={setValue} invoiceCount={3} pendingVariationCount={2} documentNotificationCount={1} />
      {sections.map(([key, label]) => <TabsContent key={key} value={key} role="region" aria-labelledby={undefined} aria-label={label}>
        <section className="mt-6 rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">{label}</h2>
          <p className="mt-2 text-sm text-muted-foreground">The selected job section appears here.</p>
        </section>
      </TabsContent>)}
    </Tabs>
    <button data-testid="outside-menu" className="mt-6 min-h-11 rounded-md border px-4">Outside menu</button>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
