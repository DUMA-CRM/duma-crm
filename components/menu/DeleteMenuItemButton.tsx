'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Trash2 } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Button } from '@/components/ui/button';

import { deleteMenuItem } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';
import type { MenuItem } from '@/types/menu';

export function DeleteMenuItemButton({ item, onDeleted }: { item: MenuItem; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteMenuItem(item.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-items') });
      setConfirming(false);
      toast('success', 'Menu item deleted.');
      onDeleted();
    },
    onError: (err) => toast('error', err.message || 'The menu item wasn’t deleted. Try again.'),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${item.name}`}
        className="size-9 text-muted-foreground/70 hover:text-destructive"
      >
        <Trash2 size={16} />
      </Button>

      {confirming && (
        <ConfirmModal
          title="Delete this menu item?"
          message={
            <>
              <span className="font-semibold text-foreground">{item.name}</span> will be removed from the menu. This cannot be undone.
            </>
          }
          confirmLabel="Delete menu item"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
