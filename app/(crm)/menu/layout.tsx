import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function MenuLayout({ children }: { children: React.ReactNode }) {
  // Menu items themselves are platform-owner only; a store manager reaches this
  // page for the recipes behind them.
  await requireAnyCapability('menu:write', 'recipes:write');
  return children;
}
