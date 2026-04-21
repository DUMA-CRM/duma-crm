'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoadingToast } from '@/components/shared/LoadingToast';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session — created inside useState so it's
  // never shared across SSR requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is fresh for 60 s — won't refetch on every component mount.
            staleTime: 60_000,
            // Retry once on failure before showing an error.
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <LoadingToast />
    </QueryClientProvider>
  );
}
