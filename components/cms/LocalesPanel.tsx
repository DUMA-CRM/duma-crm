'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { ArrowRight, Coins, FileText, Languages, Loader2, Plus, Star, Trash2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { Bone } from '@/components/shared/Skeleton';
import { useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type CmsLocale,
  createCmsLocale,
  deleteCmsLocale,
  getCmsEntries,
  getCmsLocales,
  getCmsOverview,
  updateCmsLocale,
} from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { localeDisplayName, translationCoverage } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { CURRENCIES, currencyLabel } from '@/lib/utils/currencies';
import { useCmsTenantId } from '@/components/cms/ContentScope';

import { FieldRow, InfoRow, InfoRows, PickerRow, RowMenu } from './rows';
import { cmsKeys, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

const LOCALE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

type Patch = { isDefault?: boolean; fallbackCode?: string | null; currency?: string | null };

/**
 * The languages content is written in, one question per row:
 *  - Languages: the list, the default, and per-language actions in a ⋯ menu.
 *  - When a translation is missing: what each language's readers see instead.
 *  - Prices: the currency each language's readers pay in.
 * The aside shows the result — each language's full fallback chain. Every
 * change saves at once; there is no draft.
 */
export function LocalesPanel() {
  const tenantId = useCmsTenantId();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: cmsKeys.locales(tenantId), queryFn: () => getCmsLocales(tenantId ?? undefined), enabled: !!tenantId });
  const { canModel } = useCmsAccess();
  const base = useWorkspaceCurrency();
  // One row open at a time across the sections; a tap on the open one closes it.
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<CmsLocale | null>(null);
  const toggle = (row: string) => setOpen((current) => (current === row ? null : row));

  const update = useMutation({
    mutationFn: ({ locale, patch }: { locale: CmsLocale; patch: Patch }) => updateCmsLocale(locale.code, patch, tenantId ?? undefined),
    onSuccess: (_, { locale, patch }) => {
      invalidateCms(queryClient);
      if (patch.isDefault) toast('success', `${locale.name} is now the default.`);
      if (patch.currency !== undefined) toast('success', `${locale.name} shoppers now pay in ${patch.currency ?? base}.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (locale: CmsLocale) => deleteCmsLocale(locale.code, tenantId ?? undefined),
    onSuccess: (_, locale) => {
      invalidateCms(queryClient);
      setRemoving(null);
      setOpen(null);
      toast('success', `${locale.name} removed.`);
    },
    onError: (error) => {
      setRemoving(null);
      toast('error', error.message);
    },
  });

  if (query.isPending) return <Bone className="h-96 w-full rounded-lg" />;
  if (query.isError) return <ErrorState title="Couldn’t load your languages" onRetry={() => void query.refetch()} />;

  // The default leads; the rest read alphabetically by name.
  const locales = [...query.data].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  const byCode = new Map(locales.map((locale) => [locale.code, locale]));
  const primary = locales.find((locale) => locale.isDefault);
  const others = locales.filter((locale) => !locale.isDefault);
  const nameOf = (code: string) => byCode.get(code)?.name ?? code;
  const busy = (locale: CmsLocale) => update.isPending && update.variables?.locale.code === locale.code;

  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      <SettingsTabBody narrowAside aside={<TranslationSection locales={locales} />}>
        <SettingsSection
          title="Languages"
          actions={
            canModel ? (
              <Button className="h-9 gap-1.5" onClick={() => setAdding(true)}>
                <Plus aria-hidden="true" />
                Add language
              </Button>
            ) : undefined
          }
          footnote="A language with entries can’t be removed — delete or move its entries first."
        >
          <InfoRows>
            {locales.map((locale) => (
              <InfoRow
                key={locale.code}
                icon={Languages}
                tone={locale.isDefault ? 'success' : 'default'}
                title={locale.name}
                description={locale.code}
              >
                {locale.isDefault ? (
                  <Badge variant="success">Default</Badge>
                ) : canModel ? (
                  <RowMenu
                    label={`${locale.name} actions`}
                    pending={busy(locale)}
                    items={[
                      { icon: Star, label: 'Make it the default', onClick: () => update.mutate({ locale, patch: { isDefault: true } }) },
                      { icon: Trash2, label: `Remove ${locale.name}`, danger: true, onClick: () => setRemoving(locale) },
                    ]}
                  />
                ) : null}
              </InfoRow>
            ))}
          </InfoRows>
          <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
            {others.length === 0
              ? 'Add a language and every entry gets a version to translate. Until then, everything is in ' +
                (primary?.name ?? 'the default') +
                '.'
              : `Websites that ask for no language, or one you don’t write in, get ${primary?.name ?? 'the default'}.`}
          </p>
        </SettingsSection>

        {others.length > 0 && (
          <SettingsSection title="When a translation is missing">
            <fieldset disabled={!canModel} className="min-w-0 space-y-3">
              {others.map((locale) => (
                <PickerRow
                  key={locale.code}
                  icon={ArrowRight}
                  title={`${locale.name} readers see`}
                  value={locale.fallbackCode ? nameOf(locale.fallbackCode) : (primary?.name ?? 'The default')}
                  open={open === `fallback:${locale.code}`}
                  onToggle={() => toggle(`fallback:${locale.code}`)}
                >
                  <Select
                    ariaLabel={`When ${locale.name} is missing, show`}
                    className="w-full"
                    disabled={busy(locale)}
                    value={locale.fallbackCode ?? ''}
                    onValueChange={(value) => update.mutate({ locale, patch: { fallbackCode: value || null } })}
                    options={[
                      { value: '', label: `${primary?.name ?? 'The default'} (default)` },
                      ...others.filter((other) => other.code !== locale.code).map((other) => ({ value: other.code, label: other.name })),
                    ]}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">Shown when an entry isn’t translated into {locale.name} yet.</p>
                </PickerRow>
              ))}
            </fieldset>
          </SettingsSection>
        )}

        {others.length > 0 && (
          <SettingsSection title="Prices">
            <fieldset disabled={!canModel} className="min-w-0 space-y-3">
              {others.map((locale) => (
                <PickerRow
                  key={locale.code}
                  icon={Coins}
                  title={`${locale.name} readers pay in`}
                  value={locale.currency ?? base}
                  open={open === `currency:${locale.code}`}
                  onToggle={() => toggle(`currency:${locale.code}`)}
                >
                  {/* A shop abroad: Ukrainian readers pay in hryvnia while English stays in pounds. */}
                  <Select
                    ariaLabel={`${locale.name} readers pay in`}
                    className="w-full"
                    disabled={busy(locale)}
                    value={locale.currency ?? ''}
                    onValueChange={(value) => update.mutate({ locale, patch: { currency: value || null } })}
                    options={[
                      { value: '', label: `${currencyLabel(base)} — your workspace currency` },
                      ...CURRENCIES.filter((entry) => entry.code !== base).map((entry) => ({
                        value: entry.code,
                        label: currencyLabel(entry.code),
                      })),
                    ]}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Prices on your website are shown in this currency to {locale.name} readers.
                  </p>
                </PickerRow>
              ))}
            </fieldset>
            <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              {primary?.name ?? 'The default'} always prices in {base}, your workspace currency.
            </p>
          </SettingsSection>
        )}
      </SettingsTabBody>

      {adding && <AddLocaleDialog locales={locales} onClose={() => setAdding(false)} />}
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
    </motion.div>
  );
}

/** A new language: its tag, and a name that fills itself in from the tag. */
function AddLocaleDialog({ locales, onClose }: { locales: CmsLocale[]; onClose: () => void }) {
  const tenantId = useCmsTenantId() ?? undefined;
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
  const ready = Boolean(trimmed) && !codeError && Boolean(effectiveName.trim());

  const add = useMutation({
    mutationFn: () => createCmsLocale({ code: trimmed, name: effectiveName.trim() }, tenantId),
    onSuccess: (created) => {
      invalidateCms(queryClient);
      onClose();
      toast('success', `${created.name} added. Open any entry to translate it.`);
    },
    onError: (error) => toast('error', error.message),
  });

  return (
    <Modal
      title="Add a language"
      description="Every entry gets a version in it to translate."
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-locale" disabled={!ready || add.isPending}>
            {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Add language
          </Button>
        </>
      }
    >
      <form
        id="add-locale"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) add.mutate();
        }}
      >
        <Input
          label="Language code"
          placeholder="fr or en-GB"
          className="font-mono"
          value={code}
          error={codeError}
          hint={codeError ? undefined : 'A tag such as fr, de or en-GB — the name fills itself in.'}
          onChange={(event) => setCode(event.target.value)}
        />
        <Input
          label="Name"
          placeholder="French"
          value={effectiveName}
          onChange={(event) => {
            setNameTouched(true);
            setName(event.target.value);
          }}
        />
      </form>
    </Modal>
  );
}

/**
 * How far each language has got: its versions out of every entry, and how
 * many of those are live. Counts come from the entries list's `total` (one
 * call per language and state) against the overview's entry count — the same
 * numbers the Entries tab shows, archived left out of both.
 */
function TranslationSection({ locales }: { locales: CmsLocale[] }) {
  const tenantId = useCmsTenantId();
  const overview = useQuery({
    queryKey: cmsKeys.overview(tenantId),
    queryFn: () => getCmsOverview(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const counts = useQueries({
    queries: locales.flatMap((locale) =>
      (['', 'live'] as const).map((status) => {
        const filters = { locale: locale.code, status, page: 1 };
        return {
          queryKey: cmsKeys.entries(tenantId, filters),
          queryFn: () => getCmsEntries(filters, tenantId ?? undefined),
          enabled: !!tenantId,
          select: (page: { total: number }) => page.total,
        };
      }),
    ),
  });
  const total = overview.data?.entries.total ?? 0;
  const pending = overview.isPending || counts.some((count) => count.isPending);
  const failed = overview.isError || counts.some((count) => count.isError);

  return (
    <SettingsSection title="Translation">
      {pending ? (
        <Bone className="h-32 w-full rounded-md" />
      ) : failed ? (
        <ErrorState
          title="Couldn’t count your entries"
          onRetry={() => {
            void overview.refetch();
            counts.forEach((count) => void count.refetch());
          }}
        />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">No entries yet. Write one and each language’s progress shows here.</p>
      ) : (
        <>
          <InfoRows>
            <InfoRow icon={FileText} title="Entries">
              <span className="text-sm font-semibold text-foreground">{total}</span>
            </InfoRow>
          </InfoRows>
          <div className="mt-4 space-y-4">
            {locales.map((locale, index) => {
              const translated = counts[index * 2]?.data ?? 0;
              const live = counts[index * 2 + 1]?.data ?? 0;
              const coverage = translationCoverage(translated, total);
              const complete = coverage.percent === 100;
              return (
                <FieldRow key={locale.code} icon={Languages} title={locale.name} note={`${coverage.label} · ${live} live`}>
                  <div
                    role="progressbar"
                    aria-label={`${locale.name}: ${coverage.label} entries translated`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={coverage.percent}
                    className="h-1.5 overflow-hidden rounded-full bg-band"
                  >
                    <div
                      className={cn('h-full rounded-full', complete ? 'bg-success' : 'bg-primary')}
                      style={{ width: `${coverage.percent}%` }}
                    />
                  </div>
                </FieldRow>
              );
            })}
          </div>
          {locales.length > 1 && (
            <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              Until an entry is translated, its readers get the fallback set under “When a translation is missing”.
            </p>
          )}
        </>
      )}
    </SettingsSection>
  );
}
