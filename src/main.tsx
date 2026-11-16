import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import { db } from './db/db';
import { ensureSeeded } from './db/seed';
import { requestPersistentStorage } from './lib/storage';
import './index.css';

// The service worker is registered by <UpdatePrompt /> (it asks before applying updates).
// Ask the browser not to evict local data (granted automatically for installed PWAs on Chrome).
void requestPersistentStorage();

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
