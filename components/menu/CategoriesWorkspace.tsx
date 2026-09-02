'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid, Loader2, Pencil, Plus } from '@/components/icons';
import { MenuSectionTabs } from '@/components/menu/MenuSectionTabs';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createMenuCategory, getMenuCategories, reorderMenuCategories, updateMenuCategory } from '@/lib/api/menu.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuCategoryRecord } from '@/types/menu';

export function CategoriesWorkspace() {
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const categories = useQuery({
    queryKey: ['menu-categories', tenantId],
    queryFn: () => getMenuCategories(tenantId!),
    enabled: Boolean(tenantId),
  });
  const create = useMutation({
    mutationFn: () => createMenuCategory({ tenantId: tenantId!, name, description: description || undefined, imageUrl: imageUrl || undefined }),
    onSuccess: () => {
      setName('');
      setDescription('');
      setImageUrl('');
      void qc.invalidateQueries({ queryKey: ['menu-categories'] });
      toast('success', 'Category created.');
    },
    onError: (error) => toast('error', error.message || 'The category was not created.'),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateMenuCategory>[1] }) => updateMenuCategory(id, data),
    onSuccess: () => {
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ['menu-categories'] });
    },
    onError: (error) => toast('error', error.message || 'The category was not updated.'),
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderMenuCategories(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['menu-categories'] }),
    onError: (error) => toast('error', error.message || 'The category order was not updated.'),
  });
  const move = (category: MenuCategoryRecord, direction: -1 | 1) => {
    const ordered = categories.data ?? [];
    const from = ordered.findIndex((entry) => entry.id === category.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    const ids = ordered.map((entry) => entry.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorder.mutate(ids);
  };

  return (
    <EditorShell title="Menu" icon={<LayoutGrid />} subheader={<MenuSectionTabs />}>
      {!tenantId ? (
        <EmptyState icon={LayoutGrid} title="No workspace selected" description="Choose a workspace to manage its menu categories." />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-lg border border-rule/65 bg-card">
            <div className="border-b border-rule/55 bg-band/55 px-4 py-3"><h2 className="font-semibold">Customer-facing sections</h2><p className="mt-1 text-xs text-muted-foreground">The same order is used in POS and QR menus.</p></div>
            {categories.isPending ? <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div> : (
              <div className="divide-y divide-rule/45">
                {(categories.data ?? []).map((category, index, ordered) => (
                  <div key={category.id} className="px-4 py-3">
                    {editingId === category.id ? (
                      <form className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]" onSubmit={(event) => { event.preventDefault(); update.mutate({ id: category.id, data: { name: editName, description: editDescription || null } }); }}>
                        <Input value={editName} onChange={(event) => setEditName(event.target.value)} aria-label="Category name" required />
                        <Input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} aria-label="Category description" placeholder="Description" />
                        <div className="flex gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button><Button type="submit" size="sm" disabled={update.isPending}>Save</Button></div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex shrink-0 flex-col">
                          <Button variant="ghost" size="icon" className="size-6" disabled={index === 0 || reorder.isPending} onClick={() => move(category, -1)} aria-label={`Move ${category.name} up`}><ArrowUp size={13} /></Button>
                          <Button variant="ghost" size="icon" className="size-6" disabled={index === ordered.length - 1 || reorder.isPending} onClick={() => move(category, 1)} aria-label={`Move ${category.name} down`}><ArrowDown size={13} /></Button>
                        </div>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{category.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{category.description || `${category.itemCount} ${category.itemCount === 1 ? 'item' : 'items'}`}</p></div>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditingId(category.id); setEditName(category.name); setEditDescription(category.description ?? ''); }} aria-label={`Edit ${category.name}`}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" disabled={update.isPending} onClick={() => update.mutate({ id: category.id, data: { isActive: !category.isActive } })}>{category.isActive ? <Eye /> : <EyeOff />}{category.isActive ? 'Active' : 'Hidden'}</Button>
                      </div>
                    )}
                  </div>
                ))}
                {!categories.data?.length && <EmptyState icon={LayoutGrid} title="No categories" description="Create the first section for this menu." />}
              </div>
            )}
          </section>
          <section className="rounded-lg border border-rule/65 bg-card p-4">
            <h2 className="font-semibold">New category</h2><p className="mt-1 text-xs text-muted-foreground">Add a section without a code release.</p>
            <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
              <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={50} placeholder="Pastries" />
              <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Fresh bakes and sweet treats" />
              <Input label="Image URL" type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" />
              <Button type="submit" className="w-full" disabled={!name.trim() || create.isPending}>{create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}Create category</Button>
            </form>
          </section>
        </div>
      )}
    </EditorShell>
  );
}
