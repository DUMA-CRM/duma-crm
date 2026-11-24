'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider, hashKey } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState } from 'react';

import { OfflineOrderSync } from '@/components/providers/OfflineOrderSync';
import { OfflineStatus } from '@/components/providers/OfflineStatus';
import { ServiceWorkerRegistrar } from '@/components/providers/ServiceWorkerRegistrar';
import { AppToaster } from '@/components/shared/AppToaster';

import { ApiError } from '@/lib/modules/core/client';
import { toast } from '@/lib/toast';
import { requestErrorMessage } from '@/lib/utils/error-message';
import { currentPartition } from '@/stores/workspaceStore';

const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session — created inside useState so it's
  // never shared across SSR requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Failed background reads used to be completely silent — pages rendered
        // empty states indistinguishable from "no data". Surface every query
        // failure as one toast (identical messages share one toast id, so they dedupe).
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.meta?.silentError) return;
            if (query.meta?.silentForbidden && error instanceof ApiError && error.status === 403) return;
            // Offline is expected, not an error — the POS banner covers it.
            if (isOffline()) return;
            toast('error', requestErrorMessage(error, 'load'));
          },
        }),
        // The same net for writes. A mutation with no onError of its own used
        // to fail in silence — a delete that didn't happen looked like one that
        // did. Mutations that handle their failure (their own onError, or
        // `meta: { silentError: true }`) are skipped so nothing toasts twice.
        mutationCache: new MutationCache({
          onError: (error, _variables, _result, mutation) => {
            if (mutation.options.onError || mutation.meta?.silentError) return;
            toast('error', requestErrorMessage(error, 'save', { online: isOffline() ? false : undefined }));
          },
        }),
        defaultOptions: {
          queries: {
            // Every cache entry belongs to one account and one context. The key
            // a screen writes ('orders', status) is hashed together with where
            // the tab is working, so workspace A's answers can never be read —
            // or overwritten by a late response — while the tab is in B, even
            // for the many keys that never named a tenant. Returning to A finds
            // A's entries again and revalidates them. Invalidation still matches
            // by key, across every partition.
            queryKeyHashFn: (queryKey) => hashKey([currentPartition(), ...queryKey]),
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
      {/* Once, for the whole app: every motion animation honours the system's
          reduce-motion setting. ~39 files animated without checking it. Here
          rather than in app/layout.tsx because this is the root client
          boundary — importing motion's barrel into a Server Component is not. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <AppToaster />
      <OfflineOrderSync />
      <OfflineStatus />
      <ServiceWorkerRegistrar />
    </QueryClientProvider>
  );
}
