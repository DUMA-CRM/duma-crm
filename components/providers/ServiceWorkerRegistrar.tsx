'use client';

import { useEffect } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { type BeforeInstallPromptEvent, usePwaStore } from '@/stores/pwaStore';

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent | null;
    __pwaInstalled?: boolean;
  }
}

// Registers the offline service worker and captures the PWA install prompt.
export function ServiceWorkerRegistrar() {
  const userId = useAuthStore((state) => state.user?.id);
  const authLoaded = useAuthStore((state) => state.isLoaded);

  // SW is production only — in dev it caches hot-reload chunks and causes
  // very confusing behaviour.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failing (private mode, unsupported) never blocks the app.
    });
  }, []);

  // Tell the worker which account owns cached pages/API reads. The worker
  // persists only a hash of the user ID and purges that account on logout.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !authLoaded || !('serviceWorker' in navigator)) return;

    let cancelled = false;
    void navigator.serviceWorker.ready.then(async (registration) => {
      if (cancelled) return;
      const worker = navigator.serviceWorker.controller ?? registration.active;
      if (!worker) return;

      if (!userId) {
        worker.postMessage({ type: 'DUMA_CLEAR_USER' });
        return;
      }

      // Wait for the worker to persist the scope before warming the page.
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        const timeout = window.setTimeout(resolve, 2_000);
        channel.port1.onmessage = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        worker.postMessage({ type: 'DUMA_SET_USER', userId }, [channel.port2]);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [authLoaded, userId]);

  // The inline script in the root layout captures beforeinstallprompt before
  // hydration (Chrome often fires it that early on repeat visits). Here we
  // adopt whatever it caught, and keep listening for late fires too.
  useEffect(() => {
    const store = usePwaStore.getState;

    const adopt = () => {
      if (window.__pwaInstalled) store().setInstalled(true);
      if (window.__pwaPrompt) store().setInstallPrompt(window.__pwaPrompt);
    };
    const onInstalled = () => {
      store().setInstalled(true);
      store().setInstallPrompt(null);
    };

    adopt();
    window.addEventListener('pwa:prompt-captured', adopt);
    window.addEventListener('pwa:installed', onInstalled);
    return () => {
      window.removeEventListener('pwa:prompt-captured', adopt);
      window.removeEventListener('pwa:installed', onInstalled);
    };
  }, []);

  return null;
}
