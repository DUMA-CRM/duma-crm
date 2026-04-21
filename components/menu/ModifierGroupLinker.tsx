'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';
import { getModifierGroups, getMenuItemModifierGroups, linkModifierGroup, unlinkModifierGroup } from '@/lib/api/menu.service';

interface Props {
  menuItemId: string;
}

export function ModifierGroupLinker({ menuItemId }: Props) {
  const qc = useQueryClient();

  const { data: allGroups = [] } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: getModifierGroups,
  });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['menu-item-modifier-groups', menuItemId],
    queryFn: () => getMenuItemModifierGroups(menuItemId),
  });

  const linkMutation = useMutation({
    mutationFn: (gid: string) => linkModifierGroup(menuItemId, gid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-item-modifier-groups', menuItemId] }),
  });

  const unlinkMutation = useMutation({
    mutationFn: unlinkModifierGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-item-modifier-groups', menuItemId] }),
  });

  const linkedGroupIds = new Set(links.map((l) => l.modifierGroupId));
  const unlinkedGroups = allGroups.filter((g) => !linkedGroupIds.has(g.id));
  const groupById = Object.fromEntries(allGroups.map((g) => [g.id, g]));

  if (isLoading) return null;

  return (
    <div className="border-t border-border pt-4 mt-2 space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Modifier Groups</p>

      {/* Linked — dismissible chips */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {links.map((link) => {
            const group = groupById[link.modifierGroupId];
            return (
              <span
                key={link.id}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full"
              >
                {group?.name ?? link.modifierGroupId}
                <button
                  type="button"
                  onClick={() => unlinkMutation.mutate(link.id)}
                  disabled={unlinkMutation.isPending}
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
                  aria-label={`Remove ${group?.name}`}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Unlinked — tap-to-add chips */}
      {unlinkedGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unlinkedGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={linkMutation.isPending}
              onClick={() => linkMutation.mutate(g.id)}
              className="inline-flex items-center gap-1 pl-2 pr-2.5 py-1 border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 text-xs font-medium rounded-full transition-colors disabled:opacity-40"
            >
              <Plus size={10} aria-hidden="true" />
              {g.name}
            </button>
          ))}
        </div>
      )}

      {allGroups.length === 0 && (
        <p className="text-xs text-muted-foreground">No modifier groups exist yet. Create them in the sidebar first.</p>
      )}
    </div>
  );
}
