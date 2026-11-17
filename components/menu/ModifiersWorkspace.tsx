'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { RowMenu } from '@/components/cms/rows';
import { ArrowDown, ArrowUp, Layers3, Pencil, Plus, Scale, Search, SlidersHorizontal, X } from '@/components/icons';
import { MenuSectionTabs, MenuShellIcon } from '@/components/menu/MenuSectionTabs';
import { ModifierGroupDrawer } from '@/components/menu/ModifierGroupDrawer';
import { NewModifierDrawer } from '@/components/menu/NewModifierDrawer';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { getModifierGroups, getModifiers, updateModifier, updateModifierGroup } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { type ModifierAvailability, groupModifiers, narrowModifierSections } from '@/lib/utils/modifier-list';
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
 * Modifier groups as Square and Toast manage them: a search with the Group and
 * Availability selects and the count, then each group titled above its card of
 * modifiers in the till's order — its reorder and edit in the title's menu, Add
 * beside it. Each modifier keeps an on/off switch for running out of oat milk
 * mid-service without opening the editor.
 */
export function ModifiersWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'menu:write');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<ModifierAvailability>('any');
  const reduceMotion = useReducedMotion();
  const words = useCatalogWords();
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
  const sections = narrowModifierSections(
    groupModifiers(
      modifiers.map((m) => ({ ...m, label: modifierLabel(m) })),
      orderedGroups,
      search,
    ),
    groupFilter,
    availabilityFilter,
  );
  const shownCount = sections.reduce((sum, section) => sum + section.modifiers.length, 0);
  const unavailable = modifiers.filter((m) => !m.isAvailable).length;
  const filtersActive = Boolean(search.trim()) || groupFilter !== 'all' || availabilityFilter !== 'any';
  const clearFilters = () => {
    setSearch('');
    setGroupFilter('all');
    setAvailabilityFilter('any');
  };
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
      title={words.section}
      icon={<MenuShellIcon />}
      subheader={<MenuSectionTabs />}
      actions={
        tenantId && canWrite ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setGroupDrawer('new')} aria-label="New group">
              <Layers3 size={15} aria-hidden="true" />
              <span className="hidden md:inline">New group</span>
            </Button>
            {orderedGroups.length > 0 && (
              <Button onClick={() => openNew()} aria-label="New modifier">
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
          className="flex-1"
          title="Couldn’t load modifiers"
          onRetry={() => {
            void modifiersQuery.refetch();
            void groupsQuery.refetch();
          }}
        />
      ) : loading ? (
        // The toolbar, then a group: its title and a few modifiers.
        <div aria-busy="true" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
            <Bone className="h-9 min-w-56 flex-1" />
            <Bone className="h-9 w-40" />
            <Bone className="h-9 w-40" />
          </div>
          <div>
            <Bone className="mb-3 ml-1 h-4 w-24" />
            <ListSkeleton rows={3} label="Loading modifiers" />
          </div>
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
          initial={reduceMotion ? false : 'hidden'}
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.05 } } }}
        >
          <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={14} aria-hidden="true" />}
                placeholder="Find a modifier…"
                aria-label="Find a modifier"
                rightAction={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
            </div>
            <Select
              value={groupFilter}
              onValueChange={setGroupFilter}
              options={[{ value: 'all', label: 'All groups' }, ...orderedGroups.map((group) => ({ value: group.id, label: group.name }))]}
              ariaLabel="Modifier group"
              className="w-40"
            />
            <Select
              value={availabilityFilter}
              onValueChange={(value) => setAvailabilityFilter(value as ModifierAvailability)}
              options={[
                { value: 'any', label: 'Any availability' },
                { value: 'available', label: `Available · ${modifiers.length - unavailable}` },
                { value: 'unavailable', label: `Unavailable · ${unavailable}` },
              ]}
              ariaLabel="Availability"
              className="w-40"
            />
            <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {filtersActive
                ? `${shownCount} of ${modifiers.length}`
                : `${modifiers.length} ${modifiers.length === 1 ? 'modifier' : 'modifiers'}`}
            </span>
          </motion.div>

          {sections.length === 0 ? (
            <motion.div variants={SECTION_RISE}>
              <EmptyState
                icon={Search}
                kind="search"
                title="Nothing matches"
                description="Try a different search or filter."
                action={{ label: 'Clear filters', onClick: clearFilters }}
              />
            </motion.div>
          ) : (
            sections.map((section) => {
              const index = orderedGroups.findIndex((group) => group.id === section.id);
              const group = orderedGroups[index];
              const available = section.modifiers.filter((m) => m.isAvailable).length;
              return (
                <RecordGroup
                  key={section.id}
                  id={`menu-modifiers-${section.id}`}
                  title={section.name}
                  actions={
                    <span className="flex min-w-0 items-center gap-1.5">
                      {section.modifiers.length > 0 && (
                        <span className="hidden truncate text-xs tabular-nums text-muted-foreground sm:inline">
                          {section.isSize && 'Sizes · '}
                          {available} of {section.modifiers.length} available
                        </span>
                      )}
                      {canWrite && group && (
                        <>
                          <RowMenu
                            label={`${group.name} options`}
                            pending={reorderGroups.isPending}
                            items={[
                              // Moving a group while the list is filtered would jump past groups you can't see.
                              ...(filtersActive
                                ? []
                                : [
                                    { icon: ArrowUp, label: 'Move up', disabled: index === 0, onClick: () => moveGroup(index, -1) },
                                    {
                                      icon: ArrowDown,
                                      label: 'Move down',
                                      disabled: index === orderedGroups.length - 1,
                                      onClick: () => moveGroup(index, 1),
                                    },
                                  ]),
                              { icon: Pencil, label: 'Edit group', onClick: () => setGroupDrawer(group) },
                            ]}
                          />
                          <Button variant="outline" size="sm" onClick={() => openNew(group.id)} aria-label={`Add to ${group.name}`}>
                            <Plus aria-hidden="true" /> {section.isSize ? 'Add size' : 'Add'}
                          </Button>
                        </>
                      )}
                    </span>
                  }
                >
                  <ListRowGroup aria-label={section.name}>
                    {section.modifiers.length === 0 ? (
                      <ListRow icon={section.isSize ? Scale : Layers3} tone="muted" title="No modifiers yet" muted />
                    ) : (
                      section.modifiers.map((modifier) => (
                        <ModifierRow
                          key={modifier.id}
                          modifier={modifier}
                          isSize={section.isSize}
                          canWrite={canWrite}
                          togglePending={availability.isPending && availability.variables?.id === modifier.id}
                          onToggle={(isAvailable) => availability.mutate({ id: modifier.id, isAvailable })}
                        />
                      ))
                    )}
                  </ListRowGroup>
                </RecordGroup>
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

/** One modifier: its tile and name, the price change, and the availability switch. */
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
    <ListRow
      href={`/menu/modifiers/${modifier.id}`}
      icon={isSize ? Scale : SlidersHorizontal}
      tone={isSize ? 'primary' : 'info'}
      // Whether it's offered is the switch and the greyed row — no line restating it.
      muted={!modifier.isAvailable}
      title={modifier.label}
      targetLabel={`Open ${modifier.label}`}
      trailing={
        <span className={cn('w-24 text-right text-sm tabular-nums', adjust ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
          {formatAdjust(modifier.priceAdjust, formatMoney)}
        </span>
      }
      control={
        <Switch
          label={`${modifier.label} available`}
          checked={modifier.isAvailable}
          disabled={!canWrite || togglePending}
          onChange={onToggle}
        />
      }
    />
  );
}
