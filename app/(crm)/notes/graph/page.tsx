'use client';

import { Suspense } from 'react';

import { NotesGraphPage } from '@/components/notes/NotesGraphPage';

export default function NotesGraphRoute() {
  // useSearchParams (?focus=) needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <NotesGraphPage />
    </Suspense>
  );
}
