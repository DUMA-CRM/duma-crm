'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { PromotionEditor } from '@/components/promotions/PromotionEditor';
import { PromotionsList } from '@/components/promotions/PromotionsList';

export default function PromotionsPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <PromotionsView />
    </Suspense>
  );
}

/**
 * URL-driven like Content: the open promotion lives in the query string, so
 * back closes the editor, a link to a promotion can be shared, and a refresh
 * keeps you where you were.
 */
function PromotionsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get('promotion');

  const navigate = (promotion: string | null, mode: 'push' | 'replace' = 'push') => {
    const next = new URLSearchParams(searchParams.toString());
    if (promotion) next.set('promotion', promotion);
    else next.delete('promotion');
    const query = next.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (open) {
    return (
      <PromotionEditor
        key={open}
        promotionId={open === 'new' ? null : open}
        onClose={() => navigate(null)}
        onCreated={(id) => navigate(id, 'replace')}
      />
    );
  }
  return <PromotionsList onOpen={(id) => navigate(id)} onNew={() => navigate('new')} />;
}
