'use client';

import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OfflineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-2xl items-center gap-3 rounded-xl border border-warning/40 bg-card px-4 py-3 text-sm text-foreground shadow-lg"
    >
      <WifiOff className="shrink-0 text-warning" size={18} aria-hidden="true" />
      <p>
        <span className="font-semibold">Offline.</span> Previously opened screens and data remain available. POS sales will sync
        automatically; other saves resume after reconnection.
      </p>
    </div>
  );
}
