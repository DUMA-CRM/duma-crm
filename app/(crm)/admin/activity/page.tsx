'use client';

import { Suspense } from 'react';

import { AuditLogFallback, AuditLogView } from '@/components/audit/AuditLogView';

// DUMA Admin → Audit log is the audit log read across workspaces, opening on
// the platform feed: what platform administrators did, and workspace lifecycle changes.
export default function AdminActivityPage() {
  return (
    <Suspense fallback={<AuditLogFallback platform />}>
      <AuditLogView platform />
    </Suspense>
  );
}
