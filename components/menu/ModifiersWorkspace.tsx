'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ArrowDown, ArrowUp, Layers3, Pencil, Plus, Scale, Search, SlidersHorizontal, X } from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
import { ModifierGroupDrawer } from '@/components/menu/ModifierGroupDrawer';
import { NewModifierDrawer } from '@/components/menu/NewModifierDrawer';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone, RowSkeleton } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { getModifierGroups, getModifiers, updateModifier, updateModifierGroup } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { groupModifiers } from '@/lib/utils/modifier-list';
import { modifierLabel } from '@/lib/utils/modifiers';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Modifier, ModifierGroup } from '@/types/menu';

function formatAdjust(raw: string | undefined, formatMoney: (value: number, digits?: number) => string): string {
  const n = Number.parseFloat(raw ?? '0');
  if (!n) return 'No charge';
  // Sign is explicit: a modifier that takes money off should read that way.
  return `${n > 0 ? '+' : '−'}${formatMoney(Math.abs(n), 2)}`;
}

/**
 * Modifier groups as Square and Toast manage them: each group a card — its
 * name, whether it's sizes, how many of its options are offered — holding its
 * modifiers in the till's order, with the group's own edit, reorder and "Add
 * modifier" on the card. Each modifier keeps an on/off switch for running out
 * of oat milk mid-service without opening the editor.
 */
export function ModifiersWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'menu:write');
  const [search, setSearch] = useState('');
  const [groupDrawer, setGroupDrawer] = useState<ModifierGroup | 'new' | null>(null);
  // `?new=1` (what /menu/modifiers/new redirects to) opens the drawer on arrival.
  const searchParams = useSearchParams();
  const [newFor, setNewFor] = useState<{ groupId?: string } | null>(() =>
    searchParams.get('new') ? { groupId: searchParams.get('group') ?? undefined } : null,
  );
  const openNew = (groupId?: string) => setNewFor({ groupId });
  const closeNew = () => {
    setNewFor(null);
    if (searchParams.get('new')) router.replace('/menu/modifiers', { scroll: false });
  };

  const modifiersQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifiers', tenantId),
    queryFn: () => getModifiers(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const groupsQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifier-groups', tenantId),
    queryFn: () => getModifierGroups(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });

  const availability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateModifier(id, { isAvailable }),
    onSuccess: (_, { isAvailable }) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('modifiers') });
      toast('success', isAvailable ? 'Available again.' : 'Marked unavailable — it won’t be offered at the till.');
    },
    onError: (err) => toast('error', err.message || 'Availability wasn’t updated. Try again.'),
  });
  // Groups have no bulk reorder endpoint: swapping two neighbours is two PATCHes.
  const reorderGroups = useMutation({
    mutationFn: async ([a, b]: [ModifierGroup, ModifierGroup]) => {
      await updateModifierGroup(a.id, { sortOrder: b.sortOrder });
      await updateModifierGroup(b.id, { sortOrder: a.sortOrder });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('modifier-groups') }),
    onError: (error) => toast('error', error.message || 'The order wasn’t saved. Try again.'),
  });

  const modifiers = modifiersQuery.data ?? [];
  // Counted from the modifier list: the API's modifierCount subquery returned 0 for everything.
  const orderedGroups = [...(groupsQuery.data ?? [])]
    .map((group) => ({ ...group, modifierCount: modifiers.filter((m) => m.groupId === group.id).length }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const sections = groupModifiers(
    modifiers.map((m) => ({ ...m, label: modifierLabel(m) })),
    orderedGroups,
    search,
  );
  const shownCount = sections.reduce((sum, section) => sum + section.modifiers.length, 0);
  const moveGroup = (index: number, direction: -1 | 1) => {
    const a = orderedGroups[index];
    const b = orderedGroups[index + direction];
    if (!a || !b) return;
    // Equal sort orders would swap to themselves — fall back to positions.
    if (a.sortOrder === b.sortOrder)
      reorderGroups.mutate([
        { ...a, sortOrder: index },
        { ...b, sortOrder: index + direction },
      ]);
    else reorderGroups.mutate([a, b]);
  };

  const failed = modifiersQuery.isError || groupsQuery.isError;
  const loading = modifiersQuery.isPending || groupsQuery.isPending;

  return (
    <EditorShell
      title="Menu"
      icon={<SlidersHorizontal size={20} aria-hidden="true" />}
      subheader={<MenuSectionTabs />}
      actions={
        tenantId && canWrite ? (
          <div className="flex items-center gap-1.5 md:gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => setGroupDrawer('new')} aria-label="New group">
              <Layers3 size={15} aria-hidden="true" />
              <span className="hidden md:inline">New group</span>
            </Button>
            {orderedGroups.length > 0 && (
              <Button className="gap-1.5" onClick={() => openNew()} aria-label="New modifier">
                <Plus size={15} aria-hidden="true" />
                <span className="hidden md:inline">New modifier</span>
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {!tenantId ? (
        <EmptyState icon={SlidersHorizontal} title="No workspace selected" description="Choose a workspace to manage its modifiers." />
      ) : failed ? (
        <ErrorState
          title="Couldn’t load modifiers"
          onRetry={() => {
            void modifiersQuery.refetch();
            void groupsQuery.refetch();
          }}
        />
      ) : loading ? (
        // The search row, then a group card: its header and a few modifiers.
        <div role="status" aria-busy="true" aria-label="Loading modifiers" className="space-y-5">
          <Bone className="h-9 w-full max-w-xs" aria-hidden="true" />
          {[3, 2].map((rows) => (
            <div key={rows} className="overflow-hidden rounded-lg border border-border bg-card" aria-hidden="true">
              <div className="flex items-center gap-3 border-b border-border px-3.5 py-3">
                <Bone className="size-9" />
                <Bone className="h-3.5 w-28" />
              </div>
              {Array.from({ length: rows }, (_, index) => (
                <RowSkeleton key={index} index={index} />
              ))}
            </div>
          ))}
        </div>
      ) : orderedGroups.length === 0 && modifiers.length === 0 ? (
        <EmptyState
          icon={Layers3}
          className="flex-1"
          title="No modifier groups yet"
          description="A group is a set of choices, like Size or Milk. Start with Size if drinks come in sizes."
          action={canWrite ? { label: 'New group', icon: Plus, onClick: () => setGroupDrawer('new') } : undefined}
        />
      ) : (
        <motion.div
          className="flex flex-1 flex-col gap-5"
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
        >
          <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1 lg:max-w-xs">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={14} />}
                placeholder="Find a modifier"
                aria-label="Find a modifier"
                className="border-rule"
                rightAction={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  ) : undefined
                }
              />
            </div>
            {/* Each card counts its own; a total only helps while searching. */}
            {search && (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {shownCount} of {modifiers.length} {modifiers.length === 1 ? 'modifier' : 'modifiers'}
              </span>
            )}
          </motion.div>

          {sections.length === 0 ? (
            <motion.div variants={SECTION_RISE}>
              <EmptyState
                icon={Search}
                kind="search"
                title="Nothing matches"
                description="Try another word."
                action={{ label: 'Clear search', onClick: () => setSearch('') }}
              />
            </motion.div>
          ) : (
            sections.map((section) => {
              const index = orderedGroups.findIndex((group) => group.id === section.id);
              const group = orderedGroups[index];
              const available = section.modifiers.filter((m) => m.isAvailable).length;
              return (
                <motion.section
                  key={section.id}
                  variants={SECTION_RISE}
                  aria-label={section.name}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3 border-b border-border py-2.5 pr-2 pl-3.5">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-md',
                        section.isSize ? 'bg-primary/8 text-primary' : 'bg-reference/8 text-reference',
                      )}
                      aria-hidden="true"
                    >
                      {section.isSize ? <Scale size={16} /> : <Layers3 size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold text-heading">{section.name}</h2>
                      <span className="block truncate text-xs text-muted-foreground">
                        {section.modifiers.length === 0 ? 'No modifiers yet' : `${available} of ${section.modifiers.length} available`}
                        {section.isSize && ' · Sizes'}
                      </span>
                    </span>
                    {canWrite && group && (
                      <span className="flex shrink-0 items-center">
                        {!search && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              disabled={index === 0 || reorderGroups.isPending}
                              onClick={() => moveGroup(index, -1)}
                              aria-label={`Move ${group.name} up`}
                            >
                              <ArrowUp size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground"
                              disabled={index === orderedGroups.length - 1 || reorderGroups.isPending}
                              onClick={() => moveGroup(index, 1)}
                              aria-label={`Move ${group.name} down`}
                            >
                              <ArrowDown size={14} />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={() => setGroupDrawer(group)}
                          aria-label={`Edit ${group.name}`}
                        >
                          <Pencil size={14} />
                        </Button>
                      </span>
                    )}
                  </div>
                  {section.modifiers.length > 0 && (
                    <ul>
                      {section.modifiers.map((modifier) => (
                        <ModifierRow
                          key={modifier.id}
                          modifier={modifier}
                          isSize={section.isSize}
                          canWrite={canWrite}
                          togglePending={availability.isPending && availability.variables?.id === modifier.id}
                          onToggle={(isAvailable) => availability.mutate({ id: modifier.id, isAvailable })}
                        />
                      ))}
                    </ul>
                  )}
                  {canWrite && group && (
                    <button
                      type="button"
                      onClick={() => openNew(group.id)}
                      className={cn(
                        'flex h-11 w-full items-center gap-2 px-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                        section.modifiers.length > 0 && 'border-t border-border',
                      )}
                    >
                      <Plus size={15} aria-hidden="true" />
                      Add {section.isSize ? 'a size' : `to ${group.name}`}
                    </button>
                  )}
                </motion.section>
              );
            })
          )}
        </motion.div>
      )}

      {newFor && tenantId && (
        <NewModifierDrawer tenantId={tenantId} groups={orderedGroups} defaultGroupId={newFor.groupId} onClose={closeNew} />
      )}
      {groupDrawer && tenantId && (
        <ModifierGroupDrawer
          tenantId={tenantId}
          group={groupDrawer === 'new' ? undefined : groupDrawer}
          onClose={() => setGroupDrawer(null)}
        />
      )}
    </EditorShell>
  );
}

function ModifierRow({
  modifier,
  isSize,
  canWrite,
  togglePending,
  onToggle,
}: {
  modifier: Modifier & { label: string };
  isSize: boolean;
  canWrite: boolean;
  togglePending: boolean;
  onToggle: (isAvailable: boolean) => void;
}) {
  const formatMoney = useFormatMoney();
  const adjust = Number.parseFloat(modifier.priceAdjust ?? '0') || 0;

  return (
    <li className="flex items-center gap-3 border-b border-border px-3.5 py-3 transition-colors last:border-b-0 hover:bg-band/40">
      <Link
        href={`/menu/modifiers/${modifier.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`Open ${modifier.label}`}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            isSize ? 'bg-primary/8 text-primary' : 'bg-reference/8 text-reference',
            !modifier.isAvailable && 'opacity-50',
          )}
          aria-hidden="true"
        >
          {isSize ? <Scale size={16} /> : <SlidersHorizontal size={16} />}
        </span>
        {/* Whether it's offered is the switch and the greyed tile — no line restating it. */}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-semibold',
            modifier.isAvailable ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {modifier.label}
        </span>
      </Link>
      <span
        className={cn('w-24 shrink-0 text-right text-sm tabular-nums', adjust ? 'font-semibold text-foreground' : 'text-muted-foreground')}
      >
        {formatAdjust(modifier.priceAdjust, formatMoney)}
      </span>
      <span className="flex w-24 shrink-0 items-center justify-end">
        <Switch
          label={`${modifier.label} available`}
          checked={modifier.isAvailable}
          disabled={!canWrite || togglePending}
          onChange={onToggle}
        />
      </span>
    </li>
  );
}
