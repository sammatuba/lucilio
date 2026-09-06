import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/tokens.css';
import './styles/app.css';

// Firebase's sign-in result relay only works when the app is served from its
// auth domain — browser storage partitioning breaks the cross-origin handoff
// from any other origin (the 2026-09-06 sign-in investigation). The canonical
// origin is therefore the authDomain itself (Hosting rewrite → Cloud Run);
// bounce the raw run.app origin there before anything mounts.
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
if (authDomain && location.hostname.endsWith('.run.app')) {
  location.replace(`https://${authDomain}${location.pathname}${location.search}${location.hash}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
