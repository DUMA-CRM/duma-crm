// Shared constants and small helpers for menu components.
import {
  CircleDot,
  Droplet,
  Droplets,
  Egg,
  Flame,
  FlaskConical,
  type IconComponent,
  Leaf,
  Sprout,
  TriangleAlert,
  Wheat,
} from '@/components/icons';

import type { MenuCategory, MenuCategoryRecord } from '@/types/menu';

export const CATEGORY_COLORS: Record<MenuCategory, string> = {
  coffee: 'bg-warning/6 text-warning',
  'other-hot-drinks': 'bg-info/6 text-info',
  'coffee-over-ice': 'bg-band text-primary',
  tea: 'bg-success/6 text-success',
  snacks: 'bg-muted text-muted-foreground',
};

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  coffee: 'Coffee',
  'other-hot-drinks': 'Hot Drinks',
  'coffee-over-ice': 'Iced',
  tea: 'Tea',
  snacks: 'Snacks',
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [MenuCategory, string][];

const CATEGORY_TONES: Record<NonNullable<MenuCategoryRecord['colour']>, string> = {
  warning: 'bg-warning/6 text-warning',
  info: 'bg-info/6 text-info',
  primary: 'bg-band text-primary',
  success: 'bg-success/6 text-success',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/6 text-destructive',
};

export function categoryLabel(category: string, record?: MenuCategoryRecord): string {
  if (record) return record.name;
  return CATEGORY_LABELS[category] ?? category.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function categoryTone(category: string, record?: MenuCategoryRecord): string {
  if (record?.colour) return CATEGORY_TONES[record.colour];
  return CATEGORY_COLORS[category] ?? CATEGORY_TONES.muted;
}

export const inputClass =
  'w-full h-9 rounded-md border border-input bg-control px-3 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground transition-[border-color,outline-color] duration-150 focus:border-measured focus:outline-2 focus:outline-measured sm:text-sm';

/* A glyph for each of the fourteen FSA allergens, so a chip is recognised before
   it is read. The glyph only leads: the word always stays beside it — an allergen
   answer is a compliance statement, not a decoration. */
const ALLERGEN_GLYPHS: Record<string, IconComponent> = {
  gluten: Wheat,
  eggs: Egg,
  milk: Droplet,
  fish: Droplets,
  crustaceans: Droplets,
  molluscs: Droplets,
  celery: Leaf,
  soya: Sprout,
  lupin: Sprout,
  sesame: CircleDot,
  nuts: CircleDot,
  peanuts: CircleDot,
  mustard: Flame,
  sulphites: FlaskConical,
};

/** One allergen as a chip: its glyph, then its name. */
export function AllergenChip({ allergen }: { allergen: string }) {
  const Glyph = ALLERGEN_GLYPHS[allergen.toLowerCase()] ?? TriangleAlert;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-measured/10 px-2 py-0.5 text-xs font-semibold capitalize text-measured">
      <Glyph size={12} aria-hidden="true" />
      {allergen}
    </span>
  );
}
