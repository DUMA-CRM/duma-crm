'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChefHat, Eye, Loader2, Plus, Scale, SlidersHorizontal } from '@/components/icons';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { ChoiceCards, FormSection } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createModifier } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';
import type { ModifierGroup } from '@/types/menu';

const FORM_ID = 'new-modifier-form';

/**
 * A new modifier from the list, without leaving it: name, price change and
 * group. What it uses (its recipe) needs the modifier to exist first, so
 * "Create & add recipe" goes straight to its page for that.
 */
export function NewModifierDrawer({
  tenantId,
  groups,
  defaultGroupId,
  onClose,
}: {
  tenantId: string;
  groups: ModifierGroup[];
  defaultGroupId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const ordered = [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const initial = ordered.find((g) => g.id === defaultGroupId) ?? ordered[0];
  const [label, setLabel] = useState('');
  const [priceAdjust, setPriceAdjust] = useState('0');
  // Null until the user chooses, so a drawer opened before the groups have
  // loaded (straight from a link) still lands on the default group once they do.
  const [chosenGroupId, setGroupId] = useState<string | null>(null);
  const [chosenIsSize, setIsSize] = useState<boolean | null>(null);
  const groupId = chosenGroupId ?? initial?.id ?? '';
  const [isAvailable, setIsAvailable] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [then, setThen] = useState<'stay' | 'recipe'>('stay');

  const group = ordered.find((g) => g.id === groupId);
  const isSize = chosenIsSize ?? group?.isSize ?? false;
  const labelError = label.trim().length < 1 ? 'A name is needed.' : null;
  const priceError = !/^-?\d+(\.\d{1,2})?$/.test(priceAdjust.trim()) ? 'A price like 0.50, or -0.20 to take money off.' : null;
  const groupError = !groupId ? 'Choose a group.' : null;
  const valid = !labelError && !priceError && !groupError;

  const create = useMutation({
    mutationFn: () =>
      createModifier({
        tenantId,
        label: label.trim(),
        category: group?.name ?? null,
        groupId: groupId || null,
        isSize,
        priceAdjust: priceAdjust.trim(),
        isAvailable,
      }),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('modifiers') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('modifier-groups') });
      toast('success', `${label.trim()} added to ${group?.name ?? 'modifiers'}.`);
      onClose();
      if (then === 'recipe' && saved?.id) router.push(`/menu/modifiers/${saved.id}`);
    },
    onError: (err) => toast('error', err.message || 'The modifier wasn’t created. Try again.'),
  });

  const submit = (next: 'stay' | 'recipe') => {
    setThen(next);
    setSubmitted(true);
    if (valid) create.mutate();
  };

  return (
    <Drawer
      title="New modifier"
      description="An option offered with items — a size, a milk, an extra shot."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={() => submit('recipe')} disabled={create.isPending || !groups.length}>
            {create.isPending && then === 'recipe' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ChefHat aria-hidden="true" />}
            Create &amp; add recipe
          </Button>
          <Button type="submit" form={FORM_ID} size="lg" className="flex-1" disabled={create.isPending || !groups.length}>
            {create.isPending && then === 'stay' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Create modifier
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          submit('stay');
        }}
      >
        <FormSection icon={SlidersHorizontal} title="Modifier">
          <Input label="Name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Oat milk" autoFocus error={submitted ? (labelError ?? undefined) : undefined} />
          <Input
            label="Price change"
            value={priceAdjust}
            onChange={(e) => setPriceAdjust(e.target.value)}
            inputMode="decimal"
            placeholder="0.50"
            leftIcon={<span className="text-sm">£</span>}
            className="tabular-nums"
            error={submitted ? (priceError ?? undefined) : undefined}
            hint={!priceError ? (Number(priceAdjust) === 0 ? 'No charge' : Number(priceAdjust) < 0 ? 'Takes money off the item' : 'Added to the item’s price') : undefined}
          />
        </FormSection>

        <FormSection icon={Scale} title="Group">
          {groups.length ? (
            <>
              <ChoiceCards
                columns={ordered.length >= 4 ? 4 : ordered.length === 3 ? 3 : 2}
                value={groupId}
                onChange={(value) => {
                  setGroupId(value);
                  setIsSize(ordered.find((g) => g.id === value)?.isSize ?? false);
                }}
                options={ordered.map((g) => ({ value: g.id, label: g.name }))}
              />
              {submitted && groupError && <p className="text-xs text-destructive">{groupError}</p>}
            </>
          ) : (
            <p className="rounded-md bg-measured/10 px-3 py-2 text-xs text-measured">
              No groups yet.{' '}
              <Link href="/menu/categories" className="font-semibold underline">
                Create one on Categories
              </Link>{' '}
              first — Size, Milk or Extras.
            </p>
          )}
        </FormSection>

        <div className="rounded-lg border border-rule/60 bg-card px-4 py-3.5">
          <SettingRows>
            <SettingRow icon={Scale} title="This is a size" description="Set from the group. Sizes get their own quantity column in every recipe.">
              <Switch label="This is a size" checked={isSize} onChange={setIsSize} />
            </SettingRow>
            <SettingRow icon={Eye} title="Available at the till" description="Turn off to set it up now and offer it later.">
              <Switch label="Available at the till" checked={isAvailable} onChange={setIsAvailable} />
            </SettingRow>
          </SettingRows>
        </div>
      </form>
    </Drawer>
  );
}
