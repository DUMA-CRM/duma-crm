'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Layers3, Loader2, Scale, Trash2 } from '@/components/icons';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createModifierGroup, deleteModifierGroup, updateModifierGroup } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import type { ModifierGroup } from '@/types/menu';

/** Delete · Cancel · Save — the footer of the menu's small create/edit drawers (sections, modifier groups). */
export function MenuDrawerFooter({
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

export function ModifierGroupDrawer({ tenantId, group, onClose }: { tenantId: string; group?: ModifierGroup; onClose: () => void }) {
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
      icon={Layers3}
      title={group ? 'Edit group' : 'New modifier group'}
      guidance="A set of choices, like Size or Milk. Add its options from the group's card."
      onClose={onClose}
      footer={
        <MenuDrawerFooter
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
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (!nameError) save.mutate();
        }}
      >
        <Input
          required
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={50}
          autoFocus={!group}
          placeholder="e.g. Milk"
          error={submitted ? (nameError ?? undefined) : undefined}
        />
        <div className="rounded-lg border border-border bg-field px-4 py-3.5">
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
            or delete them first.
          </p>
        )}
      </form>
    </Drawer>
  );
}
