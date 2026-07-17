'use client';

import { useEffect } from 'react';

import { type BeforeInstallPromptEvent, usePwaStore } from '@/stores/pwaStore';

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

  // Stash the one-shot install prompt so Settings can offer an Install button.
  useEffect(() => {
    const store = usePwaStore.getState;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      store().setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      store().setInstalled(true);
      store().setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return null;
}
