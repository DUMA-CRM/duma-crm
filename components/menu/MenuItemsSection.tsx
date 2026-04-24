import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MenuItemRow } from '@/components/menu/MenuItemRow';

import { addLocationMenuItem, getLocationMenuItems, removeLocationMenuItem, updateLocationMenuItem } from '@/lib/api/menu.service';
import { MenuItem } from '@/types/menu';

export function MenuItemsSection({ locationId, menuItems }: { locationId: string; menuItems: MenuItem[] }) {
  const qc = useQueryClient();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['location-menu-items', locationId],
    queryFn: () => getLocationMenuItems(locationId),
  });

  const linkMap = Object.fromEntries(links.map((l) => [l.menuItemId, l]));

  const addMutation = useMutation({
    mutationFn: ({ menuItemId, priceOverride }: { menuItemId: string; priceOverride?: string }) =>
      addLocationMenuItem(locationId, menuItemId, priceOverride),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateLocationMenuItem>[1] }) => updateLocationMenuItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] }),
  });
  const removeMutation = useMutation({
    mutationFn: removeLocationMenuItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] }),
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
      {menuItems.map((item) => {
        const link = linkMap[item.id];
        return (
          <MenuItemRow
            key={item.id}
            item={item}
            link={link}
            isSaving={isSaving}
            onSave={({ enabled, priceOverride }) => {
              if (!link && enabled) {
                addMutation.mutate({ menuItemId: item.id, priceOverride: priceOverride || undefined });
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
