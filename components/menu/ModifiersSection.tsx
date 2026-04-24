import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { PriceRow } from '@/components/menu/PriceRow';
import { MODIFIER_TYPE_LABELS } from '@/components/menu/shared';

import { addLocationModifier, getLocationModifiers, removeLocationModifier, updateLocationModifier } from '@/lib/api/menu.service';
import { LocationModifier, Modifier, ModifierGroup } from '@/types/menu';

export function ModifiersSection({
  locationId,
  modifiers,
  groups,
}: {
  locationId: string;
  modifiers: Modifier[];
  groups: ModifierGroup[];
}) {
  const qc = useQueryClient();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['location-modifiers', locationId],
    queryFn: () => getLocationModifiers(locationId),
  });

  const linkMap = Object.fromEntries(links.map((l) => [l.modifierId, l]));
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));

  const addMutation = useMutation({
    mutationFn: ({ modifierId, priceOverride }: { modifierId: string; priceOverride?: string }) =>
      addLocationModifier(locationId, modifierId, priceOverride),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-modifiers', locationId] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateLocationModifier>[1] }) => updateLocationModifier(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-modifiers', locationId] }),
  });
  const removeMutation = useMutation({
    mutationFn: removeLocationModifier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-modifiers', locationId] }),
  });

  const isSaving = addMutation.isPending || updateMutation.isPending || removeMutation.isPending;

  if (isLoading)
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {modifiers.map((mod) => {
        const link = linkMap[mod.id];
        const groupName = groupById[mod.groupId]?.name;
        return (
          <ModifierRow
            key={mod.id}
            modifier={mod}
            groupName={groupName}
            link={link}
            isSaving={isSaving}
            onSave={({ enabled, priceOverride }) => {
              if (!link && enabled) {
                addMutation.mutate({ modifierId: mod.id, priceOverride: priceOverride || undefined });
              } else if (link && !enabled) {
                removeMutation.mutate(link.id);
              } else if (link) {
                updateMutation.mutate({ id: link.id, data: { isAvailable: enabled, priceOverride: priceOverride || undefined } });
              }
            }}
          />
        );
      })}
    </div>
  );
}

function ModifierRow({
  modifier,
  groupName,
  link,
  isSaving,
  onSave,
}: {
  modifier: Modifier;
  groupName?: string;
  link?: LocationModifier;
  isSaving: boolean;
  onSave: (args: { enabled: boolean; priceOverride: string }) => void;
}) {
  const [enabled, setEnabled] = useState(link ? link.isAvailable : false);
  const [price, setPrice] = useState(link?.priceOverride ?? '');
  const isDirty = enabled !== (link ? link.isAvailable : false) || price !== (link?.priceOverride ?? '');

  const sub = [groupName, MODIFIER_TYPE_LABELS[modifier.type]].filter(Boolean).join(' · ');
  const basePriceLabel = modifier.priceAdjust ? `${Number(modifier.priceAdjust) >= 0 ? '+' : ''}£${modifier.priceAdjust}` : '£0.00';

  return (
    <PriceRow
      name={modifier.name}
      sub={sub}
      basePriceLabel={basePriceLabel}
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
