'use client';

import { useQuery } from '@tanstack/react-query';
import { MapPin, Menu } from 'lucide-react';

import { MenuItemsSection } from '@/components/menu/MenuItemsSection';
import { ModifiersSection } from '@/components/menu/ModifiersSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { getAllModifiers, getMenuItems, getModifierGroups } from '@/lib/api/menu.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function useLocationPricingData(enabled: boolean) {
  const { data: menuItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: getMenuItems,
    enabled,
  });

  const { data: modifiers = [], isLoading: modifiersLoading } = useQuery({
    queryKey: ['modifiers-all'],
    queryFn: getAllModifiers,
    enabled,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: getModifierGroups,
    enabled,
  });

  return { menuItems, modifiers, groups, itemsLoading, modifiersLoading };
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export function LocationPricingTab() {
  const { tenantId, locationId } = useWorkspaceStore();
  const { menuItems, modifiers, groups, itemsLoading, modifiersLoading } = useLocationPricingData(!!tenantId);

  if (!tenantId) {
    return <EmptyState icon={MapPin} title="No workspace selected" description="Select a workspace in Workspaces first." />;
  }

  if (!locationId) {
    return (
      <EmptyState icon={MapPin} title="No location selected" description="Pick a location above to manage its menu and modifier prices." />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-8 pb-4">
        <section>
          <Label uppercase className="mb-2">
            Menu Items
          </Label>
          {itemsLoading ? (
            <SectionSkeleton rows={4} />
          ) : menuItems.length === 0 ? (
            <EmptyState icon={Menu} title="No menu items found" description="Create them in the Items tab." />
          ) : (
            <MenuItemsSection locationId={locationId} menuItems={menuItems} />
          )}
        </section>

        <Separator />

        <section>
          <Label uppercase className="mb-2">
            Modifiers
          </Label>
          {modifiersLoading ? (
            <SectionSkeleton rows={3} />
          ) : modifiers.length === 0 ? (
            <EmptyState icon={Menu} title="No modifiers found." description="Create them in the Modifiers tab." />
          ) : (
            <ModifiersSection locationId={locationId} modifiers={modifiers} groups={groups} />
          )}
        </section>
      </div>
    </div>
  );
}
