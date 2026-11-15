'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { ArrowDown, ArrowUp, EyeOff, type IconComponent, LayoutGrid, Loader2, Palette, Pencil, Plus, Trash2 } from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
import { MenuDrawerFooter } from '@/components/menu/ModifierGroupDrawer';
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
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import {
  createMenuCategory,
  deleteMenuCategory,
  getMenuCategories,
  getMenuItems,
  reorderMenuCategories,
  updateMenuCategory,
} from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuCategoryRecord } from '@/types/menu';

/*
 * The sections guests and the till see (menu categories): an ordered list,
 * each shown or hidden, created and edited in a drawer. Modifier groups were
 * managed here too until the 2026-11 menu restructure moved them to the
 * Modifiers tab, where each group is a card holding its options — as Square
 * and Toast manage them.
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

  const categories = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId!),
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
  // Counted here from the item and modifier lists (the same cached queries the
  // other menu tabs use): the API's itemCount / modifierCount subqueries bound
  // the outer id to the inner table and returned 0 for everything. Fixed in
  // duma-api too; this keeps the numbers right until that ships.
  const items = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const itemCounts = countBy(items.data, (item) => item.categoryId);
  const orderedCategories = (categories.data ?? []).map((category) =>
    itemCounts ? { ...category, itemCount: itemCounts.get(category.id) ?? 0 } : category,
  );
  const moveCategory = (index: number, direction: -1 | 1) => {
    const ids = orderedCategories.map((c) => c.id);
    const to = index + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    reorderCategories.mutate(ids);
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
          <SettingsTabBody>
            <ListSection
              id="menu-sections"
              title={shop ? 'Categories' : 'Menu sections'}
              // The header already names the page and holds the add button.
              hideTitle
              note={shop ? 'Shoppers see them in this order.' : 'The till and the QR menu show them in this order.'}
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
          <h2 id={`${id}-title`} className="flex-1 text-base font-semibold tracking-title text-heading">
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
        <ul className="overflow-hidden rounded-lg border border-border bg-card">{children}</ul>
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
    <li className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
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
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? '');
  const [colour, setColour] = useState<NonNullable<MenuCategoryRecord['colour']>>(category?.colour ?? 'muted');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reassignTo, setReassignTo] = useState(others[0]?.id ?? '');

  const nameError = name.trim().length < 1 ? 'A name is needed.' : name.trim().length > 50 ? 'Keep it under 50 characters.' : null;
  const urlError = imageUrl.trim() && !/^https?:\/\/\S+$/.test(imageUrl.trim()) ? 'A full web address, starting https://' : null;
  // Same rule as the API (menu-categories `slug`). Blank on a new section: made from the name.
  const slugError = !slug.trim()
    ? category
      ? 'An address is needed.'
      : null
    : !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())
      ? 'Lower-case letters, numbers and single dashes, like hot-drinks'
      : null;
  const slugChanged = Boolean(category) && slug.trim() !== category?.slug;
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-categories') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-items') });
  };

  const save = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), description: description.trim() || null, imageUrl: imageUrl.trim() || null, colour, isActive };
      return category
        ? updateMenuCategory(category.id, { ...data, ...(slugChanged ? { slug: slug.trim() } : {}) })
        : createMenuCategory({
            tenantId,
            name: data.name,
            description: data.description ?? undefined,
            imageUrl: data.imageUrl ?? undefined,
            colour,
            slug: slug.trim() || undefined,
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
      icon={LayoutGrid}
      title={category ? 'Edit section' : 'New section'}
      onClose={onClose}
      footer={
        confirmDelete && category ? (
          <div className="flex gap-2">
            <Button variant="outline" size="default" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="default"
              className="flex-1"
              onClick={() => remove.mutate()}
              disabled={remove.isPending || (category.itemCount > 0 && !reassignTo)}
            >
              {remove.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              Delete section
            </Button>
          </div>
        ) : (
          <MenuDrawerFooter
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
            <FormSection framed={false} title="Move its items to">
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
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (!nameError && !urlError && !slugError) save.mutate();
          }}
        >
          <section aria-label="Section" className="space-y-3">
            <Input
              required
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
            <Input
              label="Web address"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
              maxLength={50}
              placeholder={category ? undefined : 'Made from the name'}
              className="font-mono"
              hint={
                slugChanged
                  ? `Websites asking for ?category=${category!.slug} stop matching once you save — update their links too.`
                  : 'How your online shop finds this section, like ?category=hot-drinks'
              }
              error={submitted ? (slugError ?? undefined) : undefined}
            />
          </section>
          <FormSection icon={Palette} title="Look" collapsible defaultOpen={Boolean(imageUrl || description)}>
            <div className="flex flex-col gap-1.5">
              <FieldLabel as="span">Colour</FieldLabel>
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
          <div className="rounded-lg border border-border bg-field px-4 py-3.5">
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
