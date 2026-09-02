'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Plus, Scale, Search, SlidersHorizontal } from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
import { AvailabilityToggle } from '@/components/menu/shared';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';

import { createModifierGroup, getModifierGroups, getModifiers, updateModifier } from '@/lib/api/menu.service';
import { formatMoney } from '@/lib/utils/dashboard';
import { isSizeModifier, modifierCategory, modifierLabel } from '@/lib/utils/modifiers';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Modifier } from '@/types/menu';

function formatAdjust(raw?: string): string {
  const n = Number.parseFloat(raw ?? '0');
  if (!n) return '—';
  // Sign is explicit: a modifier that takes money off should read that way.
  return `${n > 0 ? '+' : '−'}${formatMoney(Math.abs(n), 2)}`;
}

/**
 * The modifiers list. Same shape as the menu items list and as Customers and
 * Inventory: a full-width table that navigates to a full-page record.
 */
export function ModifiersWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupIsSize, setGroupIsSize] = useState(false);

  const { data: modifiers = [], isLoading } = useQuery({
    queryKey: ['modifiers', tenantId],
    queryFn: () => getModifiers(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: groups = [] } = useQuery({
    queryKey: ['modifier-groups', tenantId],
    queryFn: () => getModifierGroups(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const createGroup = useMutation({
    mutationFn: () => createModifierGroup({ tenantId: tenantId!, name: groupName, isSize: groupIsSize }),
    onSuccess: () => {
      setGroupName('');
      setGroupIsSize(false);
      void qc.invalidateQueries({ queryKey: ['modifier-groups'] });
      toast('success', 'Modifier group created.');
    },
    onError: (error) => toast('error', error.message || 'The modifier group was not created.'),
  });

  const availability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateModifier(id, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modifiers'] }),
    onError: (err) => toast('error', err.message || 'Availability wasn’t updated. Try again.'),
  });

  // Grouped by category, then the tenant's own order — the same ordering the
  // POS uses, so this list reads the way the till does.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modifiers
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (modifierCategory(a) ?? '￿').localeCompare(modifierCategory(b) ?? '￿') ||
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          modifierLabel(a).localeCompare(modifierLabel(b)),
      );
  }, [modifiers, search]);

  const columns: DataTableColumn<Modifier>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{modifierLabel(row)}</span>
          {/* Size drives the per-size columns in every recipe — worth marking. */}
          {isSizeModifier(row) && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-band px-1.5 py-0.5 text-label font-semibold text-muted-foreground">
              <Scale size={11} aria-hidden="true" />
              Size
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'group',
      header: 'Group',
      visibility: 'md',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{modifierCategory(row) ?? 'Add-ons'}</span>,
    },
    {
      id: 'price',
      header: 'Price',
      align: 'right',
      width: 'fit',
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatAdjust(row.priceAdjust)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'fit',
      cell: ({ row }) => (
        // Stop the row's navigation: running out of oat milk mid-service
        // shouldn't mean opening an editor and saving.
        <span onClick={(e) => e.stopPropagation()} role="presentation">
          <AvailabilityToggle
            on={row.isAvailable}
            pending={availability.isPending && availability.variables?.id === row.id}
            onToggle={() => availability.mutate({ id: row.id, isAvailable: !row.isAvailable })}
          />
        </span>
      ),
    },
  ];

  return (
    <EditorShell
      title="Menu"
      icon={<SlidersHorizontal size={20} aria-hidden="true" />}
      subheader={<MenuSectionTabs />}
      actions={
        tenantId ? (
          <Button className="gap-1.5" onClick={() => router.push('/menu/modifiers/new')} aria-label="New modifier">
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">New modifier</span>
          </Button>
        ) : undefined
      }
    >
      {!tenantId ? (
        <EmptyState icon={SlidersHorizontal} title="No workspace selected" description="Choose a workspace to manage its modifiers." />
      ) : (
        <div className="flex flex-col gap-4">
          <section className="rounded-sm border border-rule bg-band/45 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="min-w-48 flex-1">
                <p className="text-sm font-semibold">Modifier groups</p>
                <p className="text-xs text-muted-foreground">Organise choices such as Size, Milk and Extras.</p>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:max-w-md">
                {groups.map((group) => (
                  <span key={group.id} className="inline-flex items-center gap-1 rounded-sm border border-rule bg-card px-2 py-1 text-xs text-muted-foreground">
                    {group.isSize && <Scale size={11} aria-hidden="true" />}
                    {group.name} · {group.modifierCount}
                  </span>
                ))}
              </div>
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  createGroup.mutate();
                }}
              >
                <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="New group" aria-label="New modifier group name" className="w-40" />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={groupIsSize} onChange={(event) => setGroupIsSize(event.target.checked)} className="accent-primary" />
                  Sizes
                </label>
                <Button type="submit" size="sm" disabled={!groupName.trim() || createGroup.isPending}>Add group</Button>
              </form>
            </div>
          </section>
          {modifiers.length > 0 && (
            <div className="max-w-xs">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={14} />}
                placeholder="Search modifiers…"
                aria-label="Search modifiers"
              />
            </div>
          )}

          <DataTable
            data={filtered}
            columns={columns}
            getRowKey={(row) => row.id}
            isLoading={isLoading}
            onRowClick={({ row }) => router.push(`/menu/modifiers/${row.id}`)}
            rowAriaLabel={({ row }) => `Open ${modifierLabel(row)}`}
            stickyHeader
            aria-label="Modifiers"
            emptyState={
              modifiers.length === 0 ? (
                <EmptyState
                  icon={SlidersHorizontal}
                  title="No modifiers yet"
                  description="Sizes, milks and syrups. Build one once and attach it to as many items as you like."
                />
              ) : (
                <EmptyState icon={Search} title="No matching modifiers" description="Try a different search." />
              )
            }
            footer={
              modifiers.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {filtered.length !== modifiers.length && `${filtered.length} of `}
                  {modifiers.length} {modifiers.length === 1 ? 'modifier' : 'modifiers'}
                </p>
              ) : undefined
            }
          />
        </div>
      )}
    </EditorShell>
  );
}
