// Bundled only into ignored generated-artifacts by mobileLayout.browser.mjs.
// Uses real form components and isolated synthetic service responses; no auth or database.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { JobCostsTab } from '../src/components/job-costing/JobCostsTab';

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-background">
    <header className="border-b p-4 font-bold">ScopeClear — receipt layout test</header>
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6">
      <JobCostsTab jobId="synthetic-layout-job" />
    </main>
  </div>,
);
