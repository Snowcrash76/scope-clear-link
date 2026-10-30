// This fixture is bundled with synthetic services by redesign.browser.mjs only.
// Production entrypoints never import it or its service replacements.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
const view=new URLSearchParams(location.search).get('view')||'/dashboard';
history.replaceState(null,'',view);
createRoot(document.getElementById('root')!).render(<App/>);
