'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Plus, Scale, Search, SlidersHorizontal, X } from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
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
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { getModifierGroups, getModifiers, updateModifier } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { groupModifiers } from '@/lib/utils/modifier-list';
import { modifierLabel } from '@/lib/utils/modifiers';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Modifier } from '@/types/menu';

function formatAdjust(raw: string | undefined, formatMoney: (value: number, digits?: number) => string): string {
  const n = Number.parseFloat(raw ?? '0');
  if (!n) return 'No charge';
  // Sign is explicit: a modifier that takes money off should read that way.
  return `${n > 0 ? '+' : '−'}${formatMoney(Math.abs(n), 2)}`;
}

/**
 * The modifiers list, laid out as the Products list is: a search and group
 * filter, then modifiers under their group in the till's order as audit rows —
 * price change, and an on/off switch for running out of oat milk mid-service
 * without opening the editor. Groups themselves are managed on Categories.
 */
export function ModifiersWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'menu:write');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
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
  const { data: groups = [] } = useQuery({
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

  const modifiers = modifiersQuery.data ?? [];
  const sections = groupModifiers(
    modifiers.map((m) => ({ ...m, label: modifierLabel(m) })),
    groups,
    search,
  ).filter((section) => groupFilter === 'all' || section.id === groupFilter);
  const shownCount = sections.reduce((sum, section) => sum + section.modifiers.length, 0);

  return (
    <EditorShell
      title="Menu"
      icon={<SlidersHorizontal size={20} aria-hidden="true" />}
      subheader={<MenuSectionTabs />}
      actions={
        tenantId && canWrite ? (
          <Button className="gap-1.5" onClick={() => openNew()} aria-label="New modifier">
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">New modifier</span>
          </Button>
        ) : undefined
      }
    >
      {!tenantId ? (
        <EmptyState icon={SlidersHorizontal} title="No workspace selected" description="Choose a workspace to manage its modifiers." />
      ) : modifiersQuery.isError ? (
        <ErrorState title="Couldn’t load modifiers" onRetry={() => void modifiersQuery.refetch()} />
      ) : modifiersQuery.isPending ? (
        // The search row, then a group: its label and the card of modifiers.
        <div role="status" aria-busy="true" aria-label="Loading modifiers" className="space-y-5">
          <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
            <Bone className="h-9 min-w-56 flex-1 lg:max-w-xs" />
          </div>
          <div>
            <Bone className="mb-2 h-3 w-24" />
            <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              {Array.from({ length: 4 }, (_, index) => (
                <RowSkeleton key={index} index={index} />
              ))}
            </div>
          </div>
        </div>
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
            <Select
              value={groupFilter}
              onValueChange={setGroupFilter}
              options={[{ value: 'all', label: 'All groups' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
              ariaLabel="Group"
              className="w-44"
            />
            <span className="ml-auto text-xs text-muted-foreground">
              {shownCount !== modifiers.length && `${shownCount} of `}
              {modifiers.length} {modifiers.length === 1 ? 'modifier' : 'modifiers'} · groups are set up on{' '}
              <Link href="/menu/categories" className="font-semibold text-primary hover:underline">
                Categories
              </Link>
            </span>
          </motion.div>

          {modifiers.length === 0 ? (
            <motion.div variants={SECTION_RISE} className="flex flex-1 flex-col">
              <EmptyState
                icon={SlidersHorizontal}
                className="flex-1"
                title="No modifiers yet"
                description={`Sizes, milks and syrups. Build one once and attach it to as many items as you like${groups.length ? '.' : ' — create its group on Categories first.'}`}
                action={
                  canWrite
                    ? {
                        label: groups.length ? 'New modifier' : 'Create a group',
                        icon: Plus,
                        onClick: () => (groups.length ? openNew() : router.push('/menu/categories')),
                      }
                    : undefined
                }
              />
            </motion.div>
          ) : sections.every((section) => section.modifiers.length === 0) ? (
            <motion.div variants={SECTION_RISE}>
              <EmptyState
                icon={Search}
                kind="search"
                title="Nothing matches"
                description="Try another search or group."
                action={{
                  label: 'Clear filters',
                  onClick: () => {
                    setSearch('');
                    setGroupFilter('all');
                  },
                }}
              />
            </motion.div>
          ) : (
            sections.map((section) => (
              <motion.section key={section.id} variants={SECTION_RISE} aria-label={section.name}>
                <h2 className="mb-2 flex items-center gap-2 text-label uppercase text-muted-foreground">
                  {section.isSize && <Scale size={12} aria-hidden="true" />}
                  {section.name}
                  <span className="normal-case tabular-nums">
                    {section.modifiers.filter((m) => m.isAvailable).length}/{section.modifiers.length} available
                  </span>
                  {/* Said once for the group rather than under every size. */}
                  {section.isSize && <span className="normal-case">· recipes cost each size separately</span>}
                </h2>
                {section.modifiers.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-rule/70 px-4 py-3 text-xs text-muted-foreground">
                    Nothing in {section.name} yet.{' '}
                    {canWrite && (
                      <button type="button" onClick={() => openNew(section.id)} className="font-semibold text-primary hover:underline">
                        Add a modifier
                      </button>
                    )}
                  </p>
                ) : (
                  <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
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
              </motion.section>
            ))
          )}
        </motion.div>
      )}

      {newFor && tenantId && <NewModifierDrawer tenantId={tenantId} groups={groups} defaultGroupId={newFor.groupId} onClose={closeNew} />}
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
    <li className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 transition-colors last:border-b-0 hover:bg-band/40">
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
