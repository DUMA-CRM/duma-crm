import { Suspense } from 'react';

import { AutomationWorkspace } from '@/components/automation/AutomationWorkspace';

export default function AutomationPage() {
  return (
    <Suspense fallback={null}>
      <AutomationWorkspace />
    </Suspense>
  );
}
