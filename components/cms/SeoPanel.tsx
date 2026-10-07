'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, CheckCircle2, ChevronRight, ExternalLink, EyeOff, Info, Search } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
import { CopyButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type CmsFieldDefinition, createCmsPreviewLink, getCmsAssets } from '@/lib/modules/cms/client';
import { SERP_DESCRIPTION_MAX, SERP_TITLE_MAX, hasSeoBlock, seoChecklist, seoSnapshot, truncate } from '@/lib/utils/cms-seo';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { assetPreviewSrc, cmsKeys, copyText } from './shared';

/** "site.com › blog › autumn-menu", as a result page shows the address. */
function breadcrumb(url: string | null): { host: string; path: string } {
  if (!url) return { host: 'yoursite.com', path: '' };
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname.replace(/^www\./, ''), path: parsed.pathname.split('/').filter(Boolean).join(' › ') };
  } catch {
    return { host: 'yoursite.com', path: '' };
  }
}

/** Checks Fill SEO can fix by writing; the rest are the editor's call and jump to their field. */
const AI_FIXABLE = new Set([
  'focus-keyword',
  'title-length',
  'title-keyword',
  'description-length',
  'description-keyword',
  'description-sentence',
  'social-description',
  'structured-data',
]);
/** Where each editor-owned check is fixed in the form. */
const FIELD_FOR: Record<string, string> = { image: 'ogImage', canonical: 'canonicalUrl', indexable: 'noIndex' };

/** Scroll a form field into view and focus it, if it is on the page. */
export function goToField(key: string) {
  const id = `cms-field-${key}`;
  const target = document.getElementById(id) ?? document.querySelector<HTMLElement>(`[for="${id}"]`);
  if (!target) return;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement)
    target.focus({ preventScroll: true });
}

/**
 * Search & sharing: how the entry would look in a search result or as a
 * shared link (one at a time), its best-practice score in the header, and a
 * one-click fix for each failing check — Fill SEO for wording, the field
 * itself for what only the editor can decide.
 */
export function SeoPanel({
  fields,
  titleField,
  data,
  pageUrl,
  keyword,
  canModel,
  canFix,
  onOpenModel,
  onFillSeo,
  onRevealField,
}: {
  /** Open the SEO fields (they live folded under Content) and go to one. */
  onRevealField: (key: string) => void;
  fields: CmsFieldDefinition[];
  titleField: string | null;
  data: Record<string, unknown>;
  pageUrl: string | null;
  /** The focus keyword, once Fill SEO with AI has chosen one — adds the keyword checks. */
  keyword?: string;
  canModel: boolean;
  /** Can this person edit — and so fix anything? */
  canFix: boolean;
  onOpenModel: () => void;
  /** Run Fill SEO (in the Ask DUMA card, so the mascot shows it working). */
  onFillSeo: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const snapshot = seoSnapshot(fields, titleField, data);
  const crumb = breadcrumb(snapshot.canonicalUrl ?? pageUrl);
  const imageQuery = useQuery({
    queryKey: cmsKeys.assets(tenantId, { ids: snapshot.imageId }),
    queryFn: () => getCmsAssets({ ids: snapshot.imageId! }, tenantId ?? undefined),
    enabled: !!tenantId && !!snapshot.imageId,
  });
  const image = imageQuery.data?.data[0];
  const block = hasSeoBlock(fields);
  const checks = seoChecklist(snapshot, { keyword, imageAlt: image?.altText });
  const failing = checks.filter((check) => !check.ok);
  const passing = checks.filter((check) => check.ok);
  const clear = failing.length === 0;
  const fallback =
    snapshot.titleFromFallback && snapshot.descriptionFromFallback
      ? 'Using the entry’s title and the start of its text.'
      : snapshot.titleFromFallback
        ? 'Using the entry’s title.'
        : snapshot.descriptionFromFallback
          ? 'Using the start of the text as the description.'
          : null;

  /** What "Fix" does for a check, or null when there is nothing to click. */
  const fixFor = (id: string): (() => void) | null => {
    if (!canFix) return null;
    if (block && AI_FIXABLE.has(id)) return onFillSeo;
    if (block && FIELD_FOR[id]) return () => onRevealField(FIELD_FOR[id]!);
    if (!block && id.startsWith('title') && titleField) return () => goToField(titleField);
    return null;
  };

  return (
    <SettingsSection
      title="Search & sharing"
      actions={
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums',
              clear ? 'bg-momentum/10 text-momentum' : 'bg-measured/12 text-measured',
            )}
          >
            {clear ? (
              <CheckCircle2 size={13} className="inline -mt-px" aria-label="All checks pass" />
            ) : (
              `${passing.length}/${checks.length}`
            )}
          </span>
          {fallback && (
            <Tooltip side="top" align="end" wrap label={fallback}>
              <button
                type="button"
                aria-label="Where the preview text comes from"
                className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <Info size={15} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* The search result, then the shared link — both always in view. */}
        <>
          <div className="rounded-lg border border-rule/50 bg-control px-4 py-3">
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className="size-4 shrink-0 rounded-full bg-band" aria-hidden="true" />
              <span className="truncate">
                <span className="text-foreground">{crumb.host}</span>
                {crumb.path && ` › ${crumb.path}`}
              </span>
            </p>
            <p className="mt-1 text-base leading-snug text-reference">
              {snapshot.title ? truncate(snapshot.title, SERP_TITLE_MAX) : 'Untitled'}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {snapshot.description ? truncate(snapshot.description, SERP_DESCRIPTION_MAX) : 'No description yet.'}
            </p>
            {snapshot.noIndex && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-measured">
                <EyeOff size={12} aria-hidden="true" /> Hidden from search engines
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-rule/50 bg-control">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- tenant media served by the API
              <img
                src={assetPreviewSrc(image)}
                alt=""
                className="aspect-[1.91/1] w-full bg-band object-cover"
                style={image.focalPoint ? { objectPosition: `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%` } : undefined}
              />
            ) : (
              <div className="flex aspect-[1.91/1] items-center justify-center bg-band/60 text-xs text-muted-foreground">No image</div>
            )}
            <div className="border-t border-rule/50 px-3 py-2">
              <p className="truncate text-[0.6875rem] uppercase text-muted-foreground">{crumb.host}</p>
              <p className="truncate text-sm font-semibold text-foreground">{snapshot.socialTitle || 'Untitled'}</p>
              <p className="truncate text-xs text-muted-foreground">{snapshot.socialDescription}</p>
            </div>
          </div>
        </>

        {!block && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <RowTile icon={Search} />
              <p className="text-sm font-semibold text-foreground">No SEO fields</p>
            </div>
            {canModel && (
              <Button size="sm" variant="outline" onClick={onOpenModel}>
                Add SEO block
              </Button>
            )}
          </div>
        )}

        {failing.length > 0 && (
          <ul className="space-y-2">
            {failing.map((check) => {
              const fix = fixFor(check.id);
              return (
                <li key={check.id} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <RowTile icon={AlertTriangle} tone="warning" />
                    <Tooltip side="top" wrap label={check.fix ?? check.label} className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{check.label}</p>
                    </Tooltip>
                  </div>
                  {fix && (
                    <button
                      type="button"
                      onClick={fix}
                      className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/6"
                    >
                      {AI_FIXABLE.has(check.id) ? 'Fix' : 'Go to field'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {passing.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronRight size={13} className="transition-transform group-open:rotate-90" aria-hidden="true" />
              {passing.length} passing
            </summary>
            <ul className="mt-2 space-y-2">
              {passing.map((check) => (
                <li key={check.id} className="flex items-center gap-3">
                  <RowTile icon={CheckCircle2} tone="success" />
                  <p className="min-w-0 truncate text-sm text-muted-foreground">{check.label}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </SettingsSection>
  );
}

/** The Status card's outlined tile, tinted by what the row means. */
function RowTile({ icon: Icon, tone = 'default' }: { icon: IconComponent; tone?: 'default' | 'warning' | 'success' }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md border',
        tone === 'warning'
          ? 'border-measured/40 bg-measured/8 text-measured'
          : tone === 'success'
            ? 'border-momentum/35 bg-momentum/8 text-momentum'
            : 'border-rule/55 bg-background text-muted-foreground',
      )}
    >
      <Icon size={16} aria-hidden="true" />
    </span>
  );
}

const DURATIONS = [
  { value: '1', label: '1 hour' },
  { value: '24', label: '1 day' },
  { value: '168', label: '7 days' },
];

/**
 * A link that shows this draft on the website, for sharing with someone who
 * has no CRM login. It is signed and expires; anyone holding it can read this
 * one draft until then, so the dialog says so.
 */
export function SharePreviewDialog({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const [hours, setHours] = useState('24');
  const link = useMutation({
    mutationFn: () => createCmsPreviewLink(entryId, Number(hours), tenantId),
    onError: (error) => toast('error', error.message),
  });
  const result = link.data;
  const shown = result?.url ?? result?.apiUrl ?? '';

  return (
    <Modal
      title="Share a draft preview"
      description="Anyone with the link can see this draft — not the rest of your content — until it expires. Edits you save show up when they reload."
      size="md"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <Button disabled={link.isPending} onClick={() => link.mutate()}>
              {link.isPending ? 'Creating…' : 'Create link'}
            </Button>
          )}
        </div>
      }
    >
      {!result ? (
        <div className="space-y-2">
          <p className="text-label uppercase text-muted-foreground">Expires after</p>
          <SegmentedControl ariaLabel="Expires after" value={hours} onChange={setHours} options={DURATIONS} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input aria-label="Preview link" readOnly value={shown} className="font-mono text-xs" />
            <CopyButton
              iconOnly
              label="Copy link"
              copiedLabel="Link copied"
              onCopy={async () => {
                const copied = await copyText(shown);
                if (!copied) toast('error', 'Copy failed — select the link instead.');
                return copied;
              }}
            />
          </div>
          {result.url ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} aria-hidden="true" /> Open on the site
              </a>
            </Button>
          ) : (
            <p className={cn('text-xs text-muted-foreground')}>
              This model has no preview URL, so the link returns the draft as data. Set a preview URL on the model to get a link to the page
              itself.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Expires{' '}
            <span className="tabular-nums text-foreground">
              {new Date(result.expiresAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
            . Your site reads the draft from <span className="font-mono">?duma_preview=</span> — see API docs → Preview links.
          </p>
        </div>
      )}
    </Modal>
  );
}
