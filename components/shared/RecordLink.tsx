'use client';

import Link from 'next/link';

import { hasAnyCapability, hasCapability } from '@/lib/auth/capabilities';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';

/**
 * A record's name as a link to its page — inline, in the text's own colour,
 * underlined on hover. Without an `href` (the viewer can't open that page, or
 * there's no id) it renders the plain text, so callers never branch.
 */
export function RecordLink({
  href,
  children,
  className,
}: {
  href: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      className={cn('underline-offset-4 hover:underline focus-visible:underline', className)}
      // A link inside a clickable row must not also trigger the row.
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}

/**
 * Where each kind of record opens, for this viewer — `null` when they lack the
 * capability that record's route guards on, so the name stays plain text
 * instead of leading to a 403. Mirrors the route layouts: /staff
 * (staff:read | hr.people:read), /inventory (stock:read), /menu
 * (menu:write | recipes:write), /customers (customers:read).
 */
export function useRecordHrefs() {
  const capabilities = useAuthStore((state) => state.capabilities);
  const staff = hasAnyCapability(capabilities, 'staff:read', 'hr.people:read');
  const stock = hasCapability(capabilities, 'stock:read');
  const menu = hasAnyCapability(capabilities, 'menu:write', 'recipes:write');
  const customers = hasCapability(capabilities, 'customers:read');
  return {
    staff: (userId: string | null | undefined) => (staff && userId ? `/staff/${userId}` : null),
    stockItem: (id: string | null | undefined) => (stock && id ? `/inventory/items/${id}` : null),
    menuItem: (id: string | null | undefined) => (menu && id ? `/menu/items/${id}` : null),
    customer: (id: string | null | undefined) => (customers && id ? `/customers/${id}` : null),
  };
}
