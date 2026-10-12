'use client';

import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';
import * as React from 'react';

import { ChevronRight, type IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

/* The right-click (or long-press) menu, on radix, in the popover's surface — card
   ground, hairline, soft shadow — with rows that match the app's "…" menus.
   Radix owns placement at the pointer, keyboard, typeahead and focus return. */

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuSub = ContextMenuPrimitive.Sub;

const surface =
  'z-100 min-w-52 max-w-[calc(100vw-2rem)] rounded-lg border border-rule/70 bg-card p-1 text-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content collisionPadding={12} className={cn(surface, className)} {...props} />
    </ContextMenuPrimitive.Portal>
  );
}

const row =
  'flex w-full cursor-default select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-150 data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

function ContextMenuItem({
  icon: Icon,
  danger = false,
  shortcut,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & { icon?: IconComponent; danger?: boolean; shortcut?: string }) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        row,
        danger ? 'text-exception data-[highlighted]:bg-exception/8' : 'text-foreground data-[highlighted]:bg-band/70',
        className,
      )}
      {...props}
    >
      {Icon && <Icon size={15} className={cn('shrink-0', danger ? 'text-exception' : 'text-muted-foreground')} aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <span className="ml-3 text-xs tracking-wide text-muted-foreground">{shortcut}</span>}
    </ContextMenuPrimitive.Item>
  );
}

function ContextMenuSubTrigger({
  icon: Icon,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & { icon?: IconComponent }) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(row, 'text-foreground data-[highlighted]:bg-band/70 data-[state=open]:bg-band/70', className)}
      {...props}
    >
      {Icon && <Icon size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.SubContent collisionPadding={12} className={cn(surface, className)} {...props} />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return <ContextMenuPrimitive.Separator className={cn('my-1 h-px bg-rule/50', className)} {...props} />;
}

function ContextMenuLabel({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
  return <ContextMenuPrimitive.Label className={cn('px-2 pb-1 pt-1.5 text-label uppercase text-muted-foreground', className)} {...props} />;
}

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
