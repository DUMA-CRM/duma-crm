import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function MenuLayout({ children }: { children: React.ReactNode }) {
  // Anyone who can read the menu opens it (an auditor holds menu:read); owners
  // and store managers edit products (menu:write), and someone who only costs
  // recipes reaches this page for the recipes behind them. Edit controls are
  // gated on their write capability inside each screen.
  await requireAnyCapability('menu:read', 'menu:write', 'recipes:write');
  // No shell here: each page owns its own EditorShell, the same way Customers
  // and Inventory do. Only one may be mounted at a time — it portals into the
  // app top bar — and separate routes guarantee that.
  return children;
}
