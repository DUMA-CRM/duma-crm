import { Calculator, Package, PackageSearch } from '@/components/icons';
import type { Listing } from '@/lib/api/marketplace.service';

export function appAppearance(builtin: Listing['builtin']) {
  switch (builtin) {
    case 'margin-calculator':
      return { icon: Calculator, tile: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' };
    case 'reorder-planner':
      return { icon: PackageSearch, tile: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' };
    default:
      return { icon: Package, tile: 'bg-primary/10 text-primary' };
  }
}
