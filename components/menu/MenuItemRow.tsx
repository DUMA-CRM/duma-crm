import { useState } from 'react';

import { PriceRow } from '@/components/menu/PriceRow';
import { CATEGORY_LABELS } from '@/components/menu/shared';

import { LocationMenuItem, MenuItem } from '@/types/menu';

export function MenuItemRow({
  item,
  link,
  isSaving,
  onSave,
}: {
  item: MenuItem;
  link?: LocationMenuItem;
  isSaving: boolean;
  onSave: (args: { enabled: boolean; priceOverride: string }) => void;
}) {
  const [enabled, setEnabled] = useState(link ? link.isAvailable : false);
  const [price, setPrice] = useState(link?.priceOverride ?? '');
  const isDirty = enabled !== (link ? link.isAvailable : false) || price !== (link?.priceOverride ?? '');

  return (
    <PriceRow
      name={item.name}
      sub={CATEGORY_LABELS[item.category]}
      basePriceLabel={`£${item.basePrice}`}
      enabled={enabled}
      price={price}
      onEnabledChange={setEnabled}
      onPriceChange={setPrice}
      onSave={() => onSave({ enabled, priceOverride: price })}
      isSaving={isSaving}
      isDirty={isDirty}
    />
  );
}
