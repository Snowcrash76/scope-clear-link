// Isolated real App with synthetic services; never imported by a shipping entrypoint.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
const view = new URLSearchParams(location.search).get('view') || '/dashboard';
(window as any).__fixtureAnonymous = /^\/(login|signup|forgot-password|reset-password|employee\/login|employee\/accept)(\?|$)/.test(view) || view === '/';
history.replaceState(null, '', view);
createRoot(document.getElementById('root')!).render(<App />);
