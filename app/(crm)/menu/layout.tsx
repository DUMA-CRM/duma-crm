import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function MenuLayout({ children }: { children: React.ReactNode }) {
  // Menu items themselves are platform-owner only; a store manager reaches this
  // page for the recipes behind them.
  await requireAnyCapability('menu:write', 'recipes:write');
  // No shell here: each page owns its own EditorShell, the same way Customers
  // and Inventory do. Only one may be mounted at a time — it portals into the
  // app top bar — and separate routes guarantee that.
  return children;
}
