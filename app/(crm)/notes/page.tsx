'use client';

import { Suspense } from 'react';

import { NotesWorkspace } from '@/components/notes/NotesWorkspace';

export default function NotesPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <NotesWorkspace />
    </Suspense>
  );
}
