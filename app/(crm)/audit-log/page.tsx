'use client';

import { Suspense } from 'react';

import { AuditLogFallback, AuditLogView } from '@/components/audit/AuditLogView';

export default function AuditLogPage() {
  return (
    <Suspense fallback={<AuditLogFallback />}>
      <AuditLogView />
    </Suspense>
  );
}
