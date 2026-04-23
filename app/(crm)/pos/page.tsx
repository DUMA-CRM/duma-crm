'use client';

import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { Building2, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { MenuGrid } from '@/components/pos/MenuGrid';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Toast, type ToastMessage } from '@/components/shared/Toast';

import {
  getLocationMenuItems,
  getLocationModifiers,
  getMenuItemModifierGroups,
  getMenuItems,
  getModifierGroups,
  getModifiersByGroup,
} from '@/lib/api/menu.service';
import { createOrder } from '@/lib/api/orders.service';
import { CATEGORIES } from '@/lib/constants/pos';
import { cartItemTotal, getDefaultOptions } from '@/lib/utils/pos';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Customer } from '@/types/customers';
import type { MenuItem as ApiMenuItem, Modifier as ApiModifier, ModifierGroup as ApiModifierGroup, LocationMenuItem } from '@/types/menu';
import type { CartItem, Category, MenuItem, MenuOption, PendingOptions, PosModifierGroup } from '@/types/pos';

// ── API → POS type mapping ────────────────────────────────────────────────────

function pence(decimal: string): number {
  return Math.round(Number.parseFloat(decimal) * 100);
}

function toPosItem(
  api: ApiMenuItem,
  linkedGroupIds: string[],
  allGroupMeta: Map<string, ApiModifierGroup>,
  modifiersByGroup: Map<string, ApiModifier[]>,
  locationLink?: LocationMenuItem,
  availableModifierIds?: Set<string>,
): MenuItem {
  const price = locationLink?.priceOverride ? pence(locationLink.priceOverride) : pence(api.basePrice);

  const modifierGroups: PosModifierGroup[] = linkedGroupIds
    .map((gid) => {
      const meta = allGroupMeta.get(gid);
      const modifiers = modifiersByGroup.get(gid) ?? [];
      if (!meta || modifiers.length === 0) return null;
      return {
        groupId: gid,
        groupName: meta.name,
        required: meta.required,
        multiSelect: meta.multiSelect,
        options: modifiers
          .filter((m) => m.isAvailable && (!availableModifierIds || availableModifierIds.has(m.id)))
          .map((m): MenuOption => ({ id: m.id, label: m.name, price: m.priceAdjust ? pence(m.priceAdjust) : 0 })),
      };
    })
    .filter((g): g is PosModifierGroup => g !== null && g.options.length > 0);

  return {
    id: api.id,
    name: api.name,
    category: api.category,
    price,
    image: api.imageUrl ?? '',
    modifierGroups,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function POSPage() {
  const { tenantId, locationId } = useWorkspaceStore();
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [pending, setPending] = useState<PendingOptions>({});
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function addToast(type: ToastMessage['type'], message: string) {
    setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  }
  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const { data: apiItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: getMenuItems,
    enabled: !!tenantId,
  });

  const { data: allGroupMeta = [], isLoading: groupMetaLoading } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: getModifierGroups,
    enabled: !!tenantId,
  });

  const { data: locationLinks = [] } = useQuery({
    queryKey: ['location-menu-items', locationId],
    queryFn: () => getLocationMenuItems(locationId ?? ''),
    enabled: !!locationId,
  });

  const { data: locationModifiers = [] } = useQuery({
    queryKey: ['location-modifiers', locationId],
    queryFn: () => getLocationModifiers(locationId ?? ''),
    enabled: !!locationId,
  });

  const availableModifierIds = useMemo(
    () => new Set(locationModifiers.filter((m) => m.isAvailable).map((m) => m.modifierId)),
    [locationModifiers],
  );

  // Per-item modifier group links
  const itemGroupQueries = useQueries({
    queries: apiItems.map((item) => ({
      queryKey: ['menu-item-modifier-groups', item.id],
      queryFn: () => getMenuItemModifierGroups(item.id),
      enabled: !!tenantId && apiItems.length > 0,
    })),
  });

  // Collect all unique group IDs across all items
  const allGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const q of itemGroupQueries) {
      for (const link of q.data ?? []) ids.add(link.modifierGroupId);
    }
    return Array.from(ids);
  }, [itemGroupQueries]);

  // Fetch modifiers for each unique group in parallel
  const groupModifierQueries = useQueries({
    queries: allGroupIds.map((groupId) => ({
      queryKey: ['modifiers-by-group', groupId],
      queryFn: () => getModifiersByGroup(groupId),
      enabled: allGroupIds.length > 0,
    })),
  });

  const groupMetaMap = useMemo(() => new Map(allGroupMeta.map((g) => [g.id, g])), [allGroupMeta]);

  const modifiersByGroupMap = useMemo(() => {
    const map = new Map<string, ApiModifier[]>();
    allGroupIds.forEach((id, i) => map.set(id, groupModifierQueries[i]?.data ?? []));
    return map;
  }, [allGroupIds, groupModifierQueries]);

  const posItems = useMemo<MenuItem[]>(() => {
    if (!apiItems.length) return [];

    const linkMap = Object.fromEntries(locationLinks.map((l) => [l.menuItemId, l]));

    return apiItems
      .filter((item) => {
        if (!item.isAvailable) return false;
        if (locationId && locationLinks.length > 0) {
          const link = linkMap[item.id];
          return link ? link.isAvailable : false;
        }
        return true;
      })
      .map((item, i) => {
        const groupIds = (itemGroupQueries[i]?.data ?? []).map((l) => l.modifierGroupId);
        return toPosItem(
          item,
          groupIds,
          groupMetaMap,
          modifiersByGroupMap,
          locationId ? linkMap[item.id] : undefined,
          availableModifierIds.size > 0 ? availableModifierIds : undefined,
        );
      });
  }, [apiItems, locationLinks, locationId, itemGroupQueries, groupMetaMap, modifiersByGroupMap]);

  const filtered = useMemo(
    () => (activeCategory === 'all' ? posItems : posItems.filter((i) => i.category === activeCategory)),
    [posItems, activeCategory],
  );

  function handleSelectItem(item: MenuItem) {
    setSelectedItem(item);
    setPending(getDefaultOptions(item));
  }

  function handleAddToCart() {
    if (!selectedItem) return;
    setCart((prev) => [...prev, { cartId: `${selectedItem.id}-${Date.now()}`, item: selectedItem, quantity: 1, selections: pending }]);
    setSelectedItem(null);
  }

  function handleQty(cartId: string, delta: number) {
    setCart((prev) => prev.map((c) => (c.cartId === cartId ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0));
  }

  const { mutate: submitOrder, isPending: isPaying } = useMutation({
    mutationFn: ({ method, notes }: { method: 'cash' | 'card'; notes: string }) => {
      const subtotal = cart.reduce((sum, c) => sum + cartItemTotal(c), 0);
      // only apply loyalty discount when a customer is linked
      const total = selectedCustomer ? subtotal * 0.95 : subtotal;
      const payload = {
        locationId: locationId!,
        ...(selectedCustomer ? { customerId: selectedCustomer.id } : {}),
        source: 'pos' as const,
        totalAmount: (total / 100).toFixed(2),
        notes: notes || undefined,
        paymentMethod: method,
        items: cart.map((c) => {
          const unitPrice = c.item.price / 100;
          // only include modifiers that have a valid modifier ID
          const mods = Object.entries(c.selections)
            .filter(([, opt]) => opt != null && !!opt.id)
            .map(([, opt]) => ({
              modifierId: opt!.id!,
              name: opt!.label,
              priceAdjust: (opt!.price / 100).toFixed(2),
            }));
          const itemTotal = (unitPrice + mods.reduce((s, m) => s + Number.parseFloat(m.priceAdjust), 0)) * c.quantity;
          return {
            menuItemId: c.item.id,
            name: c.item.name,
            quantity: c.quantity,
            unitPrice: unitPrice.toFixed(2),
            subtotal: itemTotal.toFixed(2),
            ...(mods.length > 0 ? { modifiers: mods } : {}),
          };
        }),
      };
      console.log('[POS] createOrder payload', JSON.stringify(payload, null, 2));
      return createOrder(payload);
    },
    onSuccess: () => {
      setCart([]);
      setSelectedCustomer(null);
      addToast('success', 'Order placed successfully.');
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to place order. Please try again.');
    },
  });

  const isLoading =
    itemsLoading || groupMetaLoading || itemGroupQueries.some((q) => q.isLoading) || groupModifierQueries.some((q) => q.isLoading);

  return (
    <>
      <PageLayout
        eyebrow="Service Mode"
        title="Roastery Menu"
        headerSlot={<SegmentedControl options={CATEGORIES} value={activeCategory} onChange={setActiveCategory} />}
        headerBorder={false}
        sidebar={
          <OrderPanel
            cart={cart}
            selectedItem={selectedItem}
            pending={pending}
            setPending={setPending}
            onAddToCart={handleAddToCart}
            onCancelItem={() => setSelectedItem(null)}
            onQty={handleQty}
            onClearCart={() => setCart([])}
            selectedCustomer={selectedCustomer}
            onCustomerSelect={setSelectedCustomer}
            onPay={(method, notes) => submitOrder({ method, notes })}
            isPaying={isPaying}
          />
        }
      >
        {tenantId && locationId && (
          <MenuGrid items={filtered} selectedId={selectedItem?.id ?? null} onSelectItem={handleSelectItem} isLoading={isLoading} />
        )}
        {!tenantId && (
          <EmptyState icon={Building2} title="No workspace selected" description="Go to Workspaces and select a workspace first." />
        )}
        {tenantId && !locationId && (
          <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to start taking orders." />
        )}
      </PageLayout>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
