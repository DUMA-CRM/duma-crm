'use client';

import { Drawer as BaseDrawer } from '@/components/shared/Drawer';
import { Modal as BaseModal } from '@/components/shared/Modal';

import { cn } from '@/lib/utils/cn';

/** Customer flows share the app's focus trap, dismissal and pinned action areas. */
export function Modal({ className, ...props }: React.ComponentProps<typeof BaseModal>) {
  return (
    <BaseModal
      {...props}
      className={cn(
        'max-h-[calc(100dvh-2rem)] overflow-hidden rounded-xl bg-field sm:max-h-[90dvh]',
        props.footer && '[&>div:last-child_button]:h-9 [&>div:last-child_button]:text-sm',
        className,
      )}
    />
  );
}

export function Drawer(props: React.ComponentProps<typeof BaseDrawer>) {
  return <BaseDrawer {...props} />;
}
