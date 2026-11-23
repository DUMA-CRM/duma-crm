import { Calculator, Package, PackageSearch } from '@/components/icons';
import type { Listing } from '@/lib/api/marketplace.service';

/** A built-in app's glyph and tile, in the domain colours: margin is money (team green), reordering is stock (saffron). */
export function appAppearance(builtin: Listing['builtin']) {
  switch (builtin) {
    case 'margin-calculator':
      return { icon: Calculator, tile: 'bg-momentum/10 text-momentum' };
    case 'reorder-planner':
      return { icon: PackageSearch, tile: 'bg-measured/10 text-measured' };
    default:
      return { icon: Package, tile: 'bg-primary/8 text-primary' };
  }
}
