'use client';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { OfflineOrderSync } from '@/components/providers/OfflineOrderSync';
import { OfflineStatus } from '@/components/providers/OfflineStatus';
import { ServiceWorkerRegistrar } from '@/components/providers/ServiceWorkerRegistrar';
import { LoadingToast } from '@/components/shared/LoadingToast';
import { GlobalToaster } from '@/components/shared/Toast';

import { ApiError } from '@/lib/api/client';
import { toast } from '@/stores/toastStore';

function queryErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Sign in again to refresh this workspace.';
    if (error.status === 403) return 'You don’t have permission to load this information.';
    if (error.status === 404) return 'This information is no longer available.';
    if (error.status === 429) return 'DUMA is receiving too many requests. Wait a moment, then try again.';
    if (error.status >= 500) return 'DUMA’s service is temporarily unavailable. Your existing data is unchanged.';
  }
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return 'The request took too long. Check your connection, then try again.';
  }
  if (error instanceof TypeError) return 'DUMA couldn’t reach the service. Check your connection, then try again.';
  return 'The latest data couldn’t load. Try again.';
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session — created inside useState so it's
  // never shared across SSR requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Failed background reads used to be completely silent — pages rendered
        // empty states indistinguishable from "no data". Surface every query
        // failure as one toast (the store dedupes identical messages).
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.meta?.silentError) return;
            // Offline is expected, not an error — the POS banner covers it.
            if (typeof navigator !== 'undefined' && !navigator.onLine) return;
            toast('error', queryErrorMessage(error));
          },
        }),
        defaultOptions: {
          queries: {
            // Data is fresh for 60 s — won't refetch on every component mount.
            staleTime: 60_000,
            // Live operational queries already have explicit polling. Avoid a
            // page-wide refetch burst whenever the browser regains focus.
            refetchOnWindowFocus: false,
            // Retry one transient failure, never a permanent 4xx response.
            retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <LoadingToast />
      <GlobalToaster />
      <OfflineOrderSync />
      <OfflineStatus />
      <ServiceWorkerRegistrar />
    </QueryClientProvider>
  );
}
