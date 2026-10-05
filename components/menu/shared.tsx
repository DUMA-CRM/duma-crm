// Shared constants and small helpers for menu components.
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
  'w-full h-9 rounded-md border border-input bg-field px-3 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground transition-[border-color,outline-color] duration-150 focus:border-measured focus:outline-2 focus:outline-measured sm:text-sm';

