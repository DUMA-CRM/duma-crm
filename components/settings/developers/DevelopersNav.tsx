'use client';

import { usePathname, useRouter } from 'next/navigation';

import { BookOpen, KeyRound } from '@/components/icons';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

import { cn } from '@/lib/utils/cn';

type View = '/settings/developers' | '/settings/developers/docs';

/**
 * Keys and webhooks, or the reference: two routes under one settings tab, so a
 * docs link can be shared. It sits at the top of each view's sidebar.
 */
export function DevelopersNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const view: View = pathname.startsWith('/settings/developers/docs') ? '/settings/developers/docs' : '/settings/developers';
  return (
    <SegmentedControl<View>
      ariaLabel="Developers"
      className={cn('w-full [&>button]:flex-1', className)}
      value={view}
      onChange={(next) => router.push(next)}
      options={[
        { value: '/settings/developers', label: 'Keys & webhooks', icon: KeyRound },
        { value: '/settings/developers/docs', label: 'API reference', icon: BookOpen },
      ]}
    />
  );
}
