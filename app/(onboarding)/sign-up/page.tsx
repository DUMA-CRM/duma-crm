import type { Metadata } from 'next';
import { Suspense } from 'react';

import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

export const metadata: Metadata = { title: 'Set up your business · DUMA' };

// The current question lives in ?step=, read with useSearchParams — which needs
// a Suspense boundary so the rest of the page can still prerender.
export default function SignUpPage() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}
