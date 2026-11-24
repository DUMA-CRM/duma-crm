'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { ArrowRight, Coins, Languages, Loader2, Plus, Star, Trash2 } from '@/components/icons';
import { ChangeRow, ValueAside } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Modal } from '@/components/shared/Modal';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
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

import { RowMenu, RowWarning } from '@/components/shared/rows';
import { cmsKeys, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

const LOCALE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

type Patch = { isDefault?: boolean; fallbackCode?: string | null; currency?: string | null };

/**
 * The languages content is written in, in the Settings → Account layout:
 *  - Languages: the list, each row with how far its translation has got, the
 *    default marked, per-language actions in a ⋯ menu.
 *  - Missing translations | Prices, side by side: one Change row per other
 *    language — what its readers see instead, and the currency they pay in.
 * Every change saves at once; there is no draft.
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

  // The default leads; the rest read alphabetically by name.
  const locales = [...(query.data ?? [])].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  const coverage = useTranslationCounts(locales);

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

  if (query.isPending) return <ListSkeleton rows={2} label="Loading your languages" />;
  if (query.isError) return <ErrorState title="Couldn’t load your languages" onRetry={() => void query.refetch()} />;

  const byCode = new Map(locales.map((locale) => [locale.code, locale]));
  const primary = locales.find((locale) => locale.isDefault);
  const primaryName = primary?.name ?? 'The default';
  const others = locales.filter((locale) => !locale.isDefault);
  const nameOf = (code: string) => byCode.get(code)?.name ?? code;
  const busy = (locale: CmsLocale) => update.isPending && update.variables?.locale.code === locale.code;

  const languages = (
    <RecordGroup
      id="locales-languages"
      title="Languages"
      actions={
        canModel ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Add language
          </Button>
        ) : undefined
      }
      footnote={
        others.length > 0
          ? `Websites that ask for no language, or one you don’t write in, get ${primaryName}. A language with entries can’t be removed — delete or move its entries first.`
          : undefined
      }
    >
      <ListRowGroup aria-label="Languages">
        {locales.map((locale, index) => (
          <ListRow
            key={locale.code}
            icon={Languages}
            tone={locale.isDefault ? 'success' : 'primary'}
            title={locale.name}
            titleExtra={locale.isDefault ? <Badge variant="success">Default</Badge> : undefined}
            meta={
              <>
                <span className="font-mono">{locale.code}</span>
                {coverage.ready && coverage.total > 0 && ` · ${coverage.of(index).label} translated · ${coverage.live(index)} live`}
              </>
            }
            trailing={
              coverage.pending ? (
                <Bone className="hidden h-1.5 w-20 sm:block" />
              ) : coverage.ready && coverage.total > 0 ? (
                <CoverageBar name={locale.name} {...coverage.of(index)} />
              ) : undefined
            }
            control={
              !locale.isDefault && canModel ? (
                <RowMenu
                  label={`${locale.name} actions`}
                  pending={busy(locale)}
                  items={[
                    { icon: Star, label: 'Make it the default', onClick: () => update.mutate({ locale, patch: { isDefault: true } }) },
                    { icon: Trash2, label: `Remove ${locale.name}`, danger: true, onClick: () => setRemoving(locale) },
                  ]}
                />
              ) : undefined
            }
          />
        ))}
      </ListRowGroup>
      {coverage.failed && (
        <RowWarning className="mt-2">
          Couldn’t count each language’s translated entries.{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={coverage.retry}>
            Try again
          </button>
        </RowWarning>
      )}
    </RecordGroup>
  );

  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      {others.length === 0 ? (
        languages
      ) : (
        // A bento with no holes: the list | the two short sections stacked.
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">{languages}</div>
          <div className="flex min-w-0 flex-col gap-5">
            <RecordGroup card id="cms-missing-translations" title="Missing translations">
              <div>
                {others.map((locale) => (
                  <ChangeRow
                    key={locale.code}
                    icon={ArrowRight}
                    label={`${locale.name} readers see`}
                    value={<span className="truncate">{locale.fallbackCode ? nameOf(locale.fallbackCode) : primaryName}</span>}
                    open={open === `fallback:${locale.code}`}
                    onToggle={canModel ? () => toggle(`fallback:${locale.code}`) : undefined}
                  >
                    {/* Straight to the list; choosing or dismissing folds the row back up. */}
                    <Select
                      ariaLabel={`When ${locale.name} is missing, show`}
                      className="w-full"
                      disabled={busy(locale)}
                      value={locale.fallbackCode ?? ''}
                      onValueChange={(value) => update.mutate({ locale, patch: { fallbackCode: value || null } })}
                      defaultOpen
                      onOpenChange={(next) => !next && setOpen(null)}
                      options={[
                        { value: '', label: `${primaryName} (default)` },
                        ...others.filter((other) => other.code !== locale.code).map((other) => ({ value: other.code, label: other.name })),
                      ]}
                    />
                  </ChangeRow>
                ))}
              </div>
            </RecordGroup>

            <RecordGroup card id="cms-prices" title="Prices" footnote={`${primaryName} always prices in ${base}, your workspace currency.`}>
              <div>
                {others.map((locale) => (
                  <ChangeRow
                    key={locale.code}
                    icon={Coins}
                    label={`${locale.name} readers pay in`}
                    value={
                      <>
                        <span className="truncate">{currencyLabel(locale.currency ?? base)}</span>
                        {!locale.currency && <ValueAside>· workspace currency</ValueAside>}
                      </>
                    }
                    open={open === `currency:${locale.code}`}
                    onToggle={canModel ? () => toggle(`currency:${locale.code}`) : undefined}
                  >
                    {/* A shop abroad: Ukrainian readers pay in hryvnia while English stays in pounds. */}
                    <Select
                      ariaLabel={`${locale.name} readers pay in`}
                      className="w-full"
                      disabled={busy(locale)}
                      value={locale.currency ?? ''}
                      onValueChange={(value) => update.mutate({ locale, patch: { currency: value || null } })}
                      defaultOpen
                      onOpenChange={(next) => !next && setOpen(null)}
                      options={[
                        { value: '', label: `${currencyLabel(base)} — your workspace currency` },
                        ...CURRENCIES.filter((entry) => entry.code !== base).map((entry) => ({
                          value: entry.code,
                          label: currencyLabel(entry.code),
                        })),
                      ]}
                    />
                  </ChangeRow>
                ))}
              </div>
            </RecordGroup>
          </div>
        </div>
      )}

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
 * numbers the Entries tab shows, archived left out of both. Index `i` is the
 * `i`th of `locales`.
 */
function useTranslationCounts(locales: CmsLocale[]) {
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
  return {
    total,
    pending: pending && !failed,
    failed,
    ready: !pending && !failed,
    of: (index: number) => translationCoverage(counts[index * 2]?.data ?? 0, total),
    live: (index: number) => counts[index * 2 + 1]?.data ?? 0,
    retry: () => {
      void overview.refetch();
      counts.forEach((count) => void count.refetch());
    },
  };
}

/** A language's translation as a short bar; the words are in the row's meta line. */
function CoverageBar({ name, percent, label }: { name: string; percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={`${name}: ${label} entries translated`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-band sm:block"
    >
      <div className={cn('h-full rounded-full', percent === 100 ? 'bg-success' : 'bg-primary')} style={{ width: `${percent}%` }} />
    </div>
  );
}
