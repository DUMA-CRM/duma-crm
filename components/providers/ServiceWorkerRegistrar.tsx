'use client';

import { useEffect } from 'react';

import { type BeforeInstallPromptEvent, usePwaStore } from '@/stores/pwaStore';

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent | null;
    __pwaInstalled?: boolean;
  }
}

// Registers the offline service worker and captures the PWA install prompt.
export function ServiceWorkerRegistrar() {
  // SW is production only — in dev it caches hot-reload chunks and causes
  // very confusing behaviour.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failing (private mode, unsupported) never blocks the app.
    });
  }, []);

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
