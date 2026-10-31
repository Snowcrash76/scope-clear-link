import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JobSectionMenu } from '../src/components/JobSectionMenu';
import { AppHeader } from '../src/components/AppHeader';
import { JobHeader } from '../src/components/JobHeader';
import { Copy, ExternalLink, MoreVertical, Send } from 'lucide-react';
import { Tabs, TabsContent } from '../src/components/ui/tabs';

const sections = [
  ['overview', 'Overview'], ['staff', 'Team'], ['activity', 'Activity'],
  ['quote', 'Quote'], ['invoices', 'Invoices'], ['costs', 'Costs'],
  ['changes', 'Variations'], ['stages', 'Stages'], ['documents', 'Documents'],
];
function Fixture() {
  const [value, setValue] = useState(new URLSearchParams(location.search).get('tab') || 'quote');
  return <div className="min-h-screen">
    <AppHeader onOpenNavigation={() => {}} />
    <JobHeader>
      <div className="mb-3">
        <h1 className="text-xl font-bold">Example job</h1>
        <p className="text-sm text-muted-foreground">Test client · draft</p>
      </div>
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          {([['Send job', Send], ['Copy link', Copy], ['Preview', ExternalLink], ['Job actions', MoreVertical]] as const).map(([label, Icon]) =>
            <button key={String(label)} aria-label={String(label)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center"><Icon className="h-4 w-4" /></button>
          )}
        </div>
      </div>
      <JobSectionMenu value={value} onValueChange={setValue} invoiceCount={3} pendingVariationCount={2} documentCount={1} />
    </JobHeader>
    <main className="mx-auto max-w-5xl p-4">
    <Tabs value={value} onValueChange={setValue} className="min-w-0">
      {sections.map(([key, label]) => <TabsContent key={key} value={key} role="region" aria-labelledby={undefined} aria-label={label}>
        <section className="mt-6 rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">{label}</h2>
          <p className="mt-2 text-sm text-muted-foreground">The selected job section appears here.</p>
        </section>
      </TabsContent>)}
    </Tabs>
    <button data-testid="outside-menu" className="mt-6 min-h-11 rounded-md border px-4">Outside menu</button>
    <div style={{ height: 1800 }} className="mt-6 rounded-xl bg-zinc-50 p-4 text-sm text-muted-foreground">Long job content for scroll checks</div>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
