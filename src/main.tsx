import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { db } from './db/db';
import { ensureSeeded } from './db/seed';
import './index.css';

registerSW({ immediate: true });

// Seed before first render so screens never flash empty on first launch.
ensureSeeded(db)
  .catch((err) => console.error('Seeding failed', err))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        {/* Hash routing works on GitHub Pages without server rewrites. */}
        <HashRouter>
          <App />
        </HashRouter>
      </StrictMode>,
    );
  });
