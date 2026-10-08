'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Coffee, Package, ShoppingBag } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';

import { updateTenantModuleConfiguration } from '@/lib/api/modules.service';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type CatalogVocabulary, VOCABULARY_CHOICES } from '@/lib/utils/catalog-vocabulary';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
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
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const { vocabulary, catalogModule } = useCatalogWords();

  const change = useMutation({
    mutationFn: (next: CatalogVocabulary) =>
      updateTenantModuleConfiguration(tenantId!, 'catalog', catalogModule!, { vocabulary: next }, `Catalogue set to ${next} in Settings`),
    onSuccess: (_, next) => {
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules') });
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules') });
      toast('success', `Now set up for ${VOCABULARY_CHOICES.find((choice) => choice.value === next)?.label.toLowerCase()}.`);
    },
    onError: (error) => toast('error', error.message),
  });

  if (!catalogModule || catalogModule.status !== 'enabled') return null;

  return (
    <SettingsSection
      title="What you sell"
    >
      <div role="radiogroup" aria-label="What you sell" className="grid gap-2 sm:grid-cols-3">
        {VOCABULARY_CHOICES.map((choice) => {
          const Icon = ICONS[choice.value];
          const selected = vocabulary === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={change.isPending}
              onClick={() => !selected && change.mutate(choice.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors disabled:opacity-60',
                selected ? 'border-primary bg-primary/6' : 'border-rule/60 bg-control hover:border-rule',
              )}
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md border',
                  selected ? 'border-primary/40 text-primary' : 'border-rule/55 text-muted-foreground',
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
    </SettingsSection>
  );
}
