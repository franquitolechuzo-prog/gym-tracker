import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

const HOUR = 60 * 60 * 1000;

/**
 * Registers the service worker. When a new version is ready it asks before reloading
 * (an automatic reload in the middle of a set would be annoying, even though data is autosaved).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates periodically while the app stays open.
      if (registration) setInterval(() => void registration.update().catch(() => {}), HOUR);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div role="status" className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 p-3">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-neutral-700 bg-neutral-900 p-3 shadow-lg shadow-black">
        <span className="flex-1">{needRefresh ? 'Hay una versión nueva de la app.' : 'Lista para usar sin conexión.'}</span>
        {needRefresh && (
          <>
            <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
              Después
            </Button>
            <Button variant="primary" onClick={() => updateServiceWorker(true)}>
              Actualizar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
