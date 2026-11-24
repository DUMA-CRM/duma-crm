import { Calculator, FileEdit, Package, PackageSearch } from '@/components/icons';
import type { Listing } from '@/lib/api/marketplace.service';

/** Default artwork and tile colours for built-in apps. */
export function appAppearance(builtin: Listing['builtin']) {
  switch (builtin) {
    case 'margin-calculator':
      return { icon: Calculator, tile: 'bg-momentum/10 text-momentum' };
    case 'reorder-planner':
      return { icon: PackageSearch, tile: 'bg-measured/10 text-measured' };
    case 'creator-agreements':
      return { icon: FileEdit, tile: 'bg-[#e7ede2] text-[#26483c]' };
    default:
      return { icon: Package, tile: 'bg-primary/8 text-primary' };
  }
}


export function builtinAppIcon(builtin: Listing['builtin']) {
  return builtin === 'creator-agreements' ? '/marketplace/creator-agreements.webp' : undefined;
}
