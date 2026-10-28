// Isolated real-page layout fixture. Service data is stubbed only in the test bundle.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import ProfitabilityPage from '../src/components/job-costing/ProfitabilityPage';
createRoot(document.getElementById('root')!).render(<MemoryRouter><ProfitabilityPage /></MemoryRouter>);
