'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { ArrowRight, Languages, Loader2, Plus, Trash2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type CmsLocale, createCmsLocale, deleteCmsLocale, getCmsLocales, updateCmsLocale } from '@/lib/modules/cms/client';
import { fallbackChain, localeDisplayName } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { cmsKeys, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

const LOCALE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * The languages content is written in, laid out like a Settings tab: the
 * list and the add form in the main column, and what a reader actually gets —
 * each language's fallback chain — in the aside.
 */
export function LocalesPanel() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const query = useQuery({ queryKey: cmsKeys.locales(tenantId), queryFn: () => getCmsLocales(tenantId ?? undefined), enabled: !!tenantId });
  const { canModel } = useCmsAccess();
  const locales = query.data ?? [];

  return (
    <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      <SettingsTabBody aside={query.isSuccess ? <FallbackSection locales={locales} /> : undefined}>
        <SettingsSection
          title="Languages"
          description="Every entry is written once per language. The default is what a website gets when it asks for no language, or for one you don’t write in."
          actions={
            query.isSuccess ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {locales.length} {locales.length === 1 ? 'language' : 'languages'}
              </span>
            ) : undefined
          }
          footnote="A language with entries can’t be removed — delete or move its entries first."
        >
          {query.isPending ? (
            <TilesSkeleton count={2} label="Loading languages" />
          ) : query.isError ? (
            <ErrorState title="Couldn’t load your languages" onRetry={() => void query.refetch()} />
          ) : (
            <LocaleList locales={locales} canModel={canModel} />
          )}
        </SettingsSection>
        {canModel && query.isSuccess && <AddLocaleSection locales={locales} />}
      </SettingsTabBody>
    </motion.div>
  );
}

function LocaleList({ locales, canModel }: { locales: CmsLocale[]; canModel: boolean }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [removing, setRemoving] = useState<CmsLocale | null>(null);
  // The default leads; the rest read alphabetically by name.
  const sorted = [...locales].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));

  const update = useMutation({
    mutationFn: ({ locale, patch }: { locale: CmsLocale; patch: { isDefault?: boolean; fallbackCode?: string | null } }) =>
      updateCmsLocale(locale.code, patch, tenantId),
    onSuccess: (_, { locale, patch }) => {
      invalidateCms(queryClient);
      if (patch.isDefault) toast('success', `${locale.name} is now the default.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (locale: CmsLocale) => deleteCmsLocale(locale.code, tenantId),
    onSuccess: (_, locale) => {
      invalidateCms(queryClient);
      setRemoving(null);
      toast('success', `${locale.name} removed.`);
    },
    onError: (error) => {
      setRemoving(null);
      toast('error', error.message);
    },
  });

  return (
    <>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {sorted.map((locale, index) => {
            const pending = update.isPending && update.variables?.locale.code === locale.code;
            return (
              <motion.li
                key={locale.code}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : index * 0.05 } }}
                exit={{ opacity: 0, x: 16 }}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-3',
                  locale.isDefault ? 'border-primary/40 bg-primary/5' : 'border-rule/50 bg-background/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold uppercase',
                    locale.isDefault ? 'bg-primary text-primary-foreground' : 'bg-band text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {locale.code.split('-')[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
                    {locale.name}
                    {locale.isDefault && <Badge variant="success">Default</Badge>}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{locale.code}</p>
                </div>
                {!locale.isDefault && (
                  <div className="flex w-full items-center gap-1.5 sm:w-auto">
                    <Select
                      ariaLabel={`${locale.name} falls back to`}
                      className="h-8 min-w-0 flex-1 text-xs sm:w-52 sm:flex-none"
                      disabled={!canModel || pending}
                      value={locale.fallbackCode ?? ''}
                      onValueChange={(value) => update.mutate({ locale, patch: { fallbackCode: value || null } })}
                      options={[
                        { value: '', label: 'Falls back to the default' },
                        ...sorted
                          .filter((other) => other.code !== locale.code)
                          .map((other) => ({ value: other.code, label: `Falls back to ${other.name}` })),
                      ]}
                    />
                    {canModel && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          disabled={pending}
                          onClick={() => update.mutate({ locale, patch: { isDefault: true } })}
                        >
                          {pending && update.variables?.patch.isDefault ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                          Make default
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-muted-foreground hover:text-exception"
                          aria-label={`Remove ${locale.name}`}
                          onClick={() => setRemoving(locale)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {removing && (
        <ConfirmModal
          title={`Remove ${removing.name}?`}
          message="Websites asking for it will get its fallback instead. Languages that fell back to it will fall back to the default."
          confirmLabel="Remove"
          pendingLabel="Removing…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

function AddLocaleSection({ locales }: { locales: CmsLocale[] }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const existing = new Set(locales.map((locale) => locale.code));

  const trimmed = code.trim();
  const codeError =
    trimmed && !LOCALE_CODE.test(trimmed)
      ? 'Use a language tag like fr, de or en-GB'
      : trimmed && existing.has(trimmed)
        ? 'You already write in this language'
        : undefined;
  const effectiveName = nameTouched ? name : name || localeDisplayName(trimmed);

  const add = useMutation({
    mutationFn: () => createCmsLocale({ code: trimmed, name: effectiveName.trim() }, tenantId),
    onSuccess: (created) => {
      invalidateCms(queryClient);
      setCode('');
      setName('');
      setNameTouched(false);
      toast('success', `${created.name} added. Open any entry to translate it.`);
    },
    onError: (error) => toast('error', error.message),
  });

  return (
    <SettingsSection title="Add a language" description="Type a language tag such as fr, de or en-GB — the name fills itself in.">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          if (!codeError && trimmed && effectiveName.trim()) add.mutate();
        }}
      >
        <div className="sm:w-40">
          <Input
            label="Code"
            placeholder="fr or en-GB"
            className="font-mono"
            value={code}
            error={codeError}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Input
            label="Name"
            placeholder="French"
            value={effectiveName}
            onChange={(event) => {
              setNameTouched(true);
              setName(event.target.value);
            }}
          />
        </div>
        <Button
          type="submit"
          className="gap-1.5 sm:mt-6"
          disabled={!trimmed || Boolean(codeError) || !effectiveName.trim() || add.isPending}
        >
          {add.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          Add language
        </Button>
      </form>
    </SettingsSection>
  );
}

/** What a reader in each language is actually served, step by step. */
function FallbackSection({ locales }: { locales: CmsLocale[] }) {
  const byCode = new Map(locales.map((locale) => [locale.code, locale]));
  const others = locales.filter((locale) => !locale.isDefault).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <SettingsSection
      title="What readers get"
      description="When an entry isn’t written in the language a website asks for, the next one along is served instead."
      footnote={
        <>
          Websites can turn this off per request with <span className="font-mono">fallback=false</span>.
        </>
      }
    >
      {others.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground">
            <Languages size={18} aria-hidden="true" />
          </span>
          <p className="text-sm text-muted-foreground">
            One language, so there’s nothing to fall back to. Add another to translate entries.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {others.map((locale) => {
            const chain = fallbackChain(locale.code, locales);
            return (
              <li key={locale.code} className="rounded-lg border border-rule/50 bg-background/60 px-3.5 py-2.5">
                <p className="text-label uppercase text-muted-foreground">Asked for {locale.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                  {chain.map((code, index) => (
                    <span key={code} className="inline-flex items-center gap-1.5">
                      {index > 0 && <ArrowRight size={12} className="text-muted-foreground" aria-label="then" />}
                      <span
                        className={cn(
                          'rounded-sm border px-1.5 py-0.5 font-mono text-xs',
                          byCode.get(code)?.isDefault ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-rule/60 text-foreground',
                        )}
                        title={byCode.get(code)?.name}
                      >
                        {code}
                      </span>
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </SettingsSection>
  );
}
