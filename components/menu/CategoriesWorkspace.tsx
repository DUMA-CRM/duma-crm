'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  FileText,
  type IconComponent,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Scale,
  SlidersHorizontal,
  Trash2,
} from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
import { categoryTone } from '@/components/menu/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState, type EmptyStateAction } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards, FormSection } from '@/components/shared/FormParts';
import { IconTag } from '@/components/shared/IconTag';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import {
  createMenuCategory,
  createModifierGroup,
  deleteMenuCategory,
  deleteModifierGroup,
  getMenuCategories,
  getMenuItems,
  getModifierGroups,
  getModifiers,
  reorderMenuCategories,
  updateMenuCategory,
  updateModifierGroup,
} from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuCategoryRecord, ModifierGroup } from '@/types/menu';

/*
 * How the menu is organised, in one place: the sections guests and the till
 * see (menu categories), and the choices an item offers (modifier groups —
 * Size, Milk, Extras). Both are ordered lists with the same row, and both are
 * created and edited in a drawer. Creating groups used to live on the
 * Modifiers tab; it moved here so all the grouping sits together.
 */

const COLOURS: { value: NonNullable<MenuCategoryRecord['colour']>; label: string }[] = [
  { value: 'muted', label: 'Neutral' },
  { value: 'primary', label: 'Green' },
  { value: 'warning', label: 'Amber' },
  { value: 'info', label: 'Blue' },
  { value: 'success', label: 'Teal' },
  { value: 'destructive', label: 'Red' },
];

export function CategoriesWorkspace() {
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'menu:write');
  const words = useCatalogWords();
  const shop = !words.tools.kitchen;
  const [categoryDrawer, setCategoryDrawer] = useState<MenuCategoryRecord | 'new' | null>(null);
  const [groupDrawer, setGroupDrawer] = useState<ModifierGroup | 'new' | null>(null);

  const categories = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId!),
    enabled: Boolean(tenantId),
  });
  const groups = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifier-groups', tenantId),
    queryFn: () => getModifierGroups(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });

  const reorderCategories = useMutation({
    mutationFn: (ids: string[]) => reorderMenuCategories(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-categories') }),
    onError: (error) => toast('error', error.message || 'The order wasn’t saved. Try again.'),
  });
  const toggleCategory = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateMenuCategory(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-categories') });
      toast('success', isActive ? 'Section shown on the menu.' : 'Section hidden — its items don’t show at the till or online.');
    },
    onError: (error) => toast('error', error.message || 'The section wasn’t updated. Try again.'),
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

  // Counted here from the item and modifier lists (the same cached queries the
  // other menu tabs use): the API's itemCount / modifierCount subqueries bound
  // the outer id to the inner table and returned 0 for everything. Fixed in
  // duma-api too; this keeps the numbers right until that ships.
  const items = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const modifiers = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifiers', tenantId),
    queryFn: () => getModifiers(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const itemCounts = countBy(items.data, (item) => item.categoryId);
  const modifierCounts = countBy(modifiers.data, (modifier) => modifier.groupId ?? null);

  const orderedCategories = (categories.data ?? []).map((category) =>
    itemCounts ? { ...category, itemCount: itemCounts.get(category.id) ?? 0 } : category,
  );
  const orderedGroups = [...(groups.data ?? [])]
    .map((group) => (modifierCounts ? { ...group, modifierCount: modifierCounts.get(group.id) ?? 0 } : group))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const moveCategory = (index: number, direction: -1 | 1) => {
    const ids = orderedCategories.map((c) => c.id);
    const to = index + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    reorderCategories.mutate(ids);
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

  return (
    <EditorShell
      title={words.section}
      icon={<LayoutGrid size={20} aria-hidden="true" />}
      subheader={<MenuSectionTabs />}
      // The page's one primary action, so it lives in the header rather than over the list.
      actions={
        tenantId &&
        canWrite && (
          <Button className="h-9 gap-1.5" onClick={() => setCategoryDrawer('new')} aria-label={shop ? 'New category' : 'New section'}>
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">{shop ? 'New category' : 'New section'}</span>
          </Button>
        )
      }
    >
      {!tenantId ? (
        <EmptyState icon={LayoutGrid} title="No workspace selected" description={`Choose a workspace to organise its ${words.items}.`} />
      ) : (
        <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
          <SettingsTabBody
            aside={
              // Modifier groups (milks, syrups) belong to a kitchen; a shop's options live on each product.
              shop ? undefined : (
                <ListSection
                  id="modifier-groups"
                  title="Modifier groups"
                  action={
                    canWrite && (
                      <Button size="sm" onClick={() => setGroupDrawer('new')}>
                        <Plus aria-hidden="true" /> New group
                      </Button>
                    )
                  }
                  loading={groups.isPending}
                  error={groups.isError}
                  onRetry={() => void groups.refetch()}
                  empty={
                    orderedGroups.length === 0
                      ? {
                          icon: SlidersHorizontal,
                          title: 'No modifier groups yet',
                          description: 'Create Size first if drinks come in sizes — recipes cost each size separately.',
                          action: canWrite ? { label: 'New group', icon: Plus, onClick: () => setGroupDrawer('new') } : undefined,
                        }
                      : null
                  }
                >
                  {orderedGroups.map((group, index) => (
                    <OrderedRow
                      key={group.id}
                      icon={group.isSize ? Scale : SlidersHorizontal}
                      tile={group.isSize ? 'bg-primary/8 text-primary' : 'bg-reference/8 text-reference'}
                      title={group.name}
                      detail={
                        <Link href="/menu/modifiers" className="hover:underline">
                          {group.modifierCount} {group.modifierCount === 1 ? 'modifier' : 'modifiers'}
                        </Link>
                      }
                      iconLabel={group.isSize ? 'Sizes' : undefined}
                      canWrite={canWrite}
                      first={index === 0}
                      last={index === orderedGroups.length - 1}
                      busy={reorderGroups.isPending}
                      onMove={(direction) => moveGroup(index, direction)}
                      onEdit={() => setGroupDrawer(group)}
                    />
                  ))}
                </ListSection>
              )
            }
          >
            <ListSection
              id="menu-sections"
              title={shop ? 'Categories' : 'Menu sections'}
              // The header already names the page and holds the add button.
              hideTitle
              note={
                shop
                  ? 'How your products are grouped — on your website and in reports. The order here is the order shoppers see.'
                  : 'How the menu is split for guests and at the till. The order here is the order on the POS and the QR menu.'
              }
              loading={categories.isPending}
              error={categories.isError}
              onRetry={() => void categories.refetch()}
              empty={
                orderedCategories.length === 0
                  ? {
                      icon: LayoutGrid,
                      title: shop ? 'No categories yet' : 'No sections yet',
                      description: shop
                        ? 'Start with how a shopper browses — T-shirts, Hoodies, Accessories.'
                        : 'Start with how your board reads — Coffee, Tea, Bakery.',
                      action: canWrite
                        ? { label: shop ? 'New category' : 'New section', icon: Plus, onClick: () => setCategoryDrawer('new') }
                        : undefined,
                    }
                  : null
              }
            >
              {orderedCategories.map((category, index) => (
                <OrderedRow
                  key={category.id}
                  icon={LayoutGrid}
                  tile={categoryTone(category.slug, category)}
                  title={category.name}
                  muted={!category.isActive}
                  detail={[category.description, `${category.itemCount} ${category.itemCount === 1 ? words.item : words.items}`]
                    .filter(Boolean)
                    .join(' · ')}
                  // The switch and the greyed name already say it; only a reader without
                  // the switch needs the mark.
                  titleExtra={
                    !category.isActive && !canWrite ? (
                      <IconTag icon={EyeOff} label={shop ? 'Hidden from shoppers' : 'Hidden from the menu'} />
                    ) : undefined
                  }
                  canWrite={canWrite}
                  first={index === 0}
                  last={index === orderedCategories.length - 1}
                  busy={reorderCategories.isPending}
                  onMove={(direction) => moveCategory(index, direction)}
                  onEdit={() => setCategoryDrawer(category)}
                  trailing={
                    canWrite ? (
                      <Switch
                        label={`${category.name} shown ${shop ? 'to shoppers' : 'on the menu'}`}
                        checked={category.isActive}
                        disabled={toggleCategory.isPending && toggleCategory.variables?.id === category.id}
                        onChange={(isActive) => toggleCategory.mutate({ id: category.id, isActive })}
                      />
                    ) : undefined
                  }
                />
              ))}
            </ListSection>
          </SettingsTabBody>
        </motion.div>
      )}

      {categoryDrawer && tenantId && (
        <CategoryDrawer
          tenantId={tenantId}
          category={categoryDrawer === 'new' ? undefined : categoryDrawer}
          others={orderedCategories.filter((c) => categoryDrawer === 'new' || c.id !== categoryDrawer.id)}
          onClose={() => setCategoryDrawer(null)}
        />
      )}
      {groupDrawer && tenantId && (
        <GroupDrawer tenantId={tenantId} group={groupDrawer === 'new' ? undefined : groupDrawer} onClose={() => setGroupDrawer(null)} />
      )}
    </EditorShell>
  );
}

/** How many of `rows` fall under each key; undefined until the rows have loaded. */
function countBy<T>(rows: T[] | undefined, key: (row: T) => string | null): Map<string, number> | undefined {
  if (!rows) return undefined;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

function ListSection({
  id,
  title,
  hideTitle = false,
  note,
  action,
  loading,
  error,
  onRetry,
  empty,
  children,
}: {
  id: string;
  title: string;
  /** Keep the heading for screen readers only — the section stays labelled. */
  hideTitle?: boolean;
  note?: string;
  action?: React.ReactNode;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  empty: { icon: IconComponent; title: string; description: string; action?: EmptyStateAction } | null;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={SECTION_RISE} aria-labelledby={`${id}-title`} className="space-y-3">
      {hideTitle ? (
        <h2 id={`${id}-title`} className="sr-only">
          {title}
        </h2>
      ) : (
        <div className="flex min-h-9 items-center gap-3">
          <h2 id={`${id}-title`} className="flex-1 text-base font-semibold tracking-title text-foreground">
            {title}
          </h2>
          {action}
        </div>
      )}
      {error ? (
        <ErrorState title={`Couldn’t load ${title.toLowerCase()}`} onRetry={onRetry} />
      ) : loading ? (
        <ListSkeleton rows={3} label={`Loading ${title.toLowerCase()}`} />
      ) : empty ? (
        <EmptyState icon={empty.icon} compact title={empty.title} description={empty.description} action={empty.action} />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">{children}</ul>
      )}
      {note && <p className="px-1 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </motion.section>
  );
}

/** One entry in an ordered list: move up/down, a tile, name and detail, then a status and edit. */
function OrderedRow({
  icon: Icon,
  tile,
  title,
  detail,
  iconLabel,
  titleExtra,
  muted,
  trailing,
  canWrite,
  first,
  last,
  busy,
  onMove,
  onEdit,
}: {
  icon: IconComponent;
  tile: string;
  title: string;
  detail: React.ReactNode;
  /** What the tile's glyph means, when it carries information (a size group). */
  iconLabel?: string;
  titleExtra?: React.ReactNode;
  muted?: boolean;
  trailing?: React.ReactNode;
  canWrite: boolean;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-rule/45 px-3 py-2.5 last:border-b-0">
      {canWrite && (
        <span className="flex shrink-0 flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={first || busy}
            onClick={() => onMove(-1)}
            aria-label={`Move ${title} up`}
          >
            <ArrowUp size={13} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={last || busy}
            onClick={() => onMove(1)}
            aria-label={`Move ${title} down`}
          >
            <ArrowDown size={13} />
          </Button>
        </span>
      )}
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', tile)}
        title={iconLabel}
        role={iconLabel ? 'img' : undefined}
        aria-label={iconLabel}
        aria-hidden={iconLabel ? undefined : true}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-sm font-semibold', muted ? 'text-muted-foreground' : 'text-foreground')}>{title}</span>
          {titleExtra}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      {trailing}
      {canWrite && (
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" onClick={onEdit} aria-label={`Edit ${title}`}>
          <Pencil size={14} />
        </Button>
      )}
    </li>
  );
}

// ── Drawers ──────────────────────────────────────────────────────────────────

function Footer({
  form,
  pending,
  label,
  onCancel,
  onDelete,
  deleting,
}: {
  form: string;
  pending: boolean;
  label: string;
  onCancel: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="text-exception hover:bg-exception/6 hover:text-exception"
          onClick={onDelete}
          disabled={pending || deleting}
        >
          {deleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          Delete
        </Button>
      )}
      <Button variant="outline" size="lg" className="flex-1" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" form={form} size="lg" className="flex-1" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {label}
      </Button>
    </div>
  );
}

function CategoryDrawer({
  tenantId,
  category,
  others,
  onClose,
}: {
  tenantId: string;
  category?: MenuCategoryRecord;
  others: MenuCategoryRecord[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? '');
  const [colour, setColour] = useState<NonNullable<MenuCategoryRecord['colour']>>(category?.colour ?? 'muted');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reassignTo, setReassignTo] = useState(others[0]?.id ?? '');

  const nameError = name.trim().length < 1 ? 'A name is needed.' : name.trim().length > 50 ? 'Keep it under 50 characters.' : null;
  const urlError = imageUrl.trim() && !/^https?:\/\/\S+$/.test(imageUrl.trim()) ? 'A full web address, starting https://' : null;
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-categories') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-items') });
  };

  const save = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), description: description.trim() || null, imageUrl: imageUrl.trim() || null, colour, isActive };
      return category
        ? updateMenuCategory(category.id, data)
        : createMenuCategory({
            tenantId,
            name: data.name,
            description: data.description ?? undefined,
            imageUrl: data.imageUrl ?? undefined,
            colour,
          });
    },
    onSuccess: () => {
      invalidate();
      toast('success', category ? 'Section updated.' : `${name.trim()} added to the menu.`);
      onClose();
    },
    onError: (error) => toast('error', error.message || 'The section wasn’t saved. Try again.'),
  });
  const remove = useMutation({
    mutationFn: () => deleteMenuCategory(category!.id, category!.itemCount > 0 ? reassignTo : undefined),
    onSuccess: () => {
      invalidate();
      toast('success', `${category!.name} deleted.`);
      onClose();
    },
    onError: (error) => toast('error', error.message || 'The section wasn’t deleted. Try again.'),
  });

  return (
    <Drawer
      title={category ? 'Edit section' : 'New section'}
      description="A heading on the menu — at the till and online."
      onClose={onClose}
      footer={
        confirmDelete && category ? (
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="flex-1"
              onClick={() => remove.mutate()}
              disabled={remove.isPending || (category.itemCount > 0 && !reassignTo)}
            >
              {remove.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              Delete section
            </Button>
          </div>
        ) : (
          <Footer
            form="category-form"
            pending={save.isPending}
            label={category ? 'Save changes' : 'Add section'}
            onCancel={onClose}
            onDelete={category ? () => setConfirmDelete(true) : undefined}
          />
        )
      }
    >
      {confirmDelete && category ? (
        <div className="space-y-6">
          <p className="rounded-md bg-exception/6 px-3 py-2 text-xs leading-relaxed text-exception">
            {category.itemCount > 0
              ? `${category.itemCount} ${category.itemCount === 1 ? 'item is' : 'items are'} in ${category.name}. Choose where they move before it’s deleted.`
              : `${category.name} has no items, so nothing else changes.`}
          </p>
          {category.itemCount > 0 && (
            <FormSection icon={LayoutGrid} title="Move its items to">
              {others.length ? (
                <Select
                  value={reassignTo}
                  onValueChange={setReassignTo}
                  options={others.map((c) => ({ value: c.id, label: c.name }))}
                  ariaLabel="Move items to"
                  className="w-full"
                />
              ) : (
                <p className="text-xs text-muted-foreground">There’s no other section to move them to. Create one first.</p>
              )}
            </FormSection>
          )}
        </div>
      ) : (
        <form
          id="category-form"
          noValidate
          className="space-y-7"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (!nameError && !urlError) save.mutate();
          }}
        >
          <FormSection icon={LayoutGrid} title="Section">
            <Input
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              autoFocus={!category}
              placeholder="e.g. Pastries"
              error={submitted ? (nameError ?? undefined) : undefined}
            />
            <Input
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="Optional — shown under the heading online"
            />
          </FormSection>
          <FormSection icon={FileText} title="Look">
            <div className="flex flex-col gap-1.5">
              <span className="text-label uppercase text-muted-foreground">Colour</span>
              <ChoiceCards columns={3} value={colour} onChange={setColour} options={COLOURS} />
            </div>
            <Input
              label="Image"
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://… (optional)"
              error={submitted ? (urlError ?? undefined) : undefined}
            />
          </FormSection>
          <div className="rounded-lg border border-rule/60 bg-card px-4 py-3.5">
            <SettingRows>
              <SettingRow
                icon={LayoutGrid}
                title="Shown on the menu"
                description="Hidden sections keep their items but don’t show at the till or online."
              >
                <Switch label="Shown on the menu" checked={isActive} onChange={setIsActive} />
              </SettingRow>
            </SettingRows>
          </div>
        </form>
      )}
    </Drawer>
  );
}

function GroupDrawer({ tenantId, group, onClose }: { tenantId: string; group?: ModifierGroup; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(group?.name ?? '');
  const [isSize, setIsSize] = useState(group?.isSize ?? false);
  const [submitted, setSubmitted] = useState(false);
  const nameError = name.trim().length < 1 ? 'A name is needed.' : name.trim().length > 50 ? 'Keep it under 50 characters.' : null;
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('modifier-groups') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('modifiers') });
  };

  const save = useMutation({
    mutationFn: () =>
      group ? updateModifierGroup(group.id, { name: name.trim(), isSize }) : createModifierGroup({ tenantId, name: name.trim(), isSize }),
    onSuccess: () => {
      invalidate();
      toast('success', group ? 'Group updated.' : `${name.trim()} group added.`);
      onClose();
    },
    onError: (error) => toast('error', error.message || 'The group wasn’t saved. Try again.'),
  });
  const remove = useMutation({
    mutationFn: () => deleteModifierGroup(group!.id),
    onSuccess: () => {
      invalidate();
      toast('success', `${group!.name} deleted.`);
      onClose();
    },
    onError: (error) => toast('error', error.message || 'The group wasn’t deleted. Try again.'),
  });
  const inUse = (group?.modifierCount ?? 0) > 0;

  return (
    <Drawer
      title={group ? 'Edit group' : 'New modifier group'}
      description="A set of choices, like Size or Milk. Add the choices themselves on the Modifiers tab."
      onClose={onClose}
      footer={
        <Footer
          form="group-form"
          pending={save.isPending}
          label={group ? 'Save changes' : 'Add group'}
          onCancel={onClose}
          onDelete={group && !inUse ? () => remove.mutate() : undefined}
          deleting={remove.isPending}
        />
      }
    >
      <form
        id="group-form"
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (!nameError) save.mutate();
        }}
      >
        <FormSection icon={SlidersHorizontal} title="Group">
          <Input
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
            autoFocus={!group}
            placeholder="e.g. Milk"
            error={submitted ? (nameError ?? undefined) : undefined}
          />
        </FormSection>
        <div className="rounded-lg border border-rule/60 bg-card px-4 py-3.5">
          <SettingRows>
            <SettingRow
              icon={Scale}
              title="These are sizes"
              description="Recipes get a column per size, so a large can use more milk than a small."
            >
              <Switch label="These are sizes" checked={isSize} onChange={setIsSize} />
            </SettingRow>
          </SettingRows>
        </div>
        {group && inUse && (
          <p className="px-1 text-xs text-muted-foreground">
            {group.modifierCount} {group.modifierCount === 1 ? 'modifier is' : 'modifiers are'} in this group, so it can’t be deleted. Move
            or delete them on the Modifiers tab first.
          </p>
        )}
      </form>
    </Drawer>
  );
}
