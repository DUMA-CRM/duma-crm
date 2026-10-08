'use client';

import { useState } from 'react';

import { useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';
import { homeCountries } from '@/lib/utils/delivery-address';

/**
 * The countries this workspace and person most likely deliver to, best first —
 * from the workspace currency and every language the browser lists. Pinned at
 * the top of a country list; the first is a new address's default. Never empty.
 */
export function useHomeCountries(): string[] {
  const currency = useWorkspaceCurrency();
  const [languages] = useState(() => [...(globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? ''])].filter(Boolean));
  const found = homeCountries({ languages, currency });
  return found.length > 0 ? found : ['GB'];
}
