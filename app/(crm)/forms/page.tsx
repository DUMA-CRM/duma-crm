'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { type EditorTab, FormEditor } from '@/components/forms/FormEditor';
import { FormsList } from '@/components/forms/FormsList';

const TABS: readonly EditorTab[] = ['build', 'settings', 'share', 'responses', 'summary'];

export default function FormsPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <FormsView />
    </Suspense>
  );
}

/**
 * URL-driven like Promotions and Content: the open form and its tab live in
 * the query string, so Back closes the editor, a link to a form's responses
 * can be shared, and a refresh keeps you where you were.
 */
function FormsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get('form');
  const requested = searchParams.get('tab') as EditorTab | null;
  const tab = requested && TABS.includes(requested) ? requested : 'build';

  const navigate = (next: { form: string | null; tab?: EditorTab }, mode: 'push' | 'replace' = 'push') => {
    const params = new URLSearchParams();
    if (next.form) params.set('form', next.form);
    if (next.form && next.tab && next.tab !== 'build') params.set('tab', next.tab);
    const query = params.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (open) {
    return (
      <FormEditor
        key={open}
        formId={open}
        tab={tab}
        onTab={(next) => navigate({ form: open, tab: next }, 'replace')}
        onClose={() => navigate({ form: null })}
        onOpen={(id, nextTab) => navigate({ form: id, tab: nextTab })}
      />
    );
  }
  return <FormsList onOpen={(id, nextTab) => navigate({ form: id, tab: nextTab })} />;
}
