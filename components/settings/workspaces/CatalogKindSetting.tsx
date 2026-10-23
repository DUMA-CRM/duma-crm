'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Coffee, Package, ShoppingBag } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { Modal } from '@/components/shared/Modal';

import { updateTenantModuleConfiguration } from '@/lib/api/modules.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { type CatalogVocabulary, VOCABULARY_CHOICES } from '@/lib/utils/catalog-vocabulary';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const ICONS: Record<CatalogVocabulary, IconComponent> = { menu: Coffee, retail: ShoppingBag, mixed: Package };

/**
 * "What do you sell?" after setup — for a workspace created before the
 * question existed, or one whose business changed. It rewrites the catalog
 * module's `vocabulary`, which decides the words (Menu or Products) and the
 * tools (recipes and modifiers, or sizes, stock and photos). Nothing is
 * deleted: a tool switched off keeps its data for when it is switched back.
 */
export function CatalogKindSetting() {
  const [editing, setEditing] = useState(false);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canEdit = hasCapability(capabilities, 'settings:write');
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const { vocabulary, catalogModule } = useCatalogWords();

  const change = useMutation({
    mutationFn: (next: CatalogVocabulary) =>
      updateTenantModuleConfiguration(tenantId!, 'catalog', catalogModule!, { vocabulary: next }, `Catalogue set to ${next} in Settings`),
    onSuccess: (_, next) => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules') });
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules') });
      toast('success', `Now set up for ${VOCABULARY_CHOICES.find((choice) => choice.value === next)?.label.toLowerCase()}.`);
    },
    onError: (error) => toast('error', error.message),
  });

  if (!catalogModule || catalogModule.status !== 'enabled') return null;

  return (
    <>
      <Fact
        icon={ICONS[vocabulary]}
        label="What you sell"
        value={VOCABULARY_CHOICES.find((choice) => choice.value === vocabulary)?.label}
        {...(canEdit ? { onSelect: () => setEditing(true), action: 'Change' } : {})}
      />
      {editing && (
        <Modal title="What you sell" onClose={() => !change.isPending && setEditing(false)}>
          <div role="radiogroup" aria-label="What you sell" className="grid gap-2">
            {VOCABULARY_CHOICES.map((choice) => {
              const Icon = ICONS[choice.value];
              const selected = vocabulary === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!canEdit || change.isPending}
                  onClick={() => !selected && change.mutate(choice.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring disabled:opacity-60',
                    selected
                      ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]'
                      : 'border-rule/70 bg-control hover:border-rule hover:bg-band/45',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors duration-150',
                      selected
                        ? 'border-primary/40 bg-primary text-primary-foreground'
                        : 'border-rule/55 bg-background text-muted-foreground',
                    )}
                  >
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{choice.label}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">{choice.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
