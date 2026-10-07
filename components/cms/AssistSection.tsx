'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { AlignLeft, CheckCircle2, Languages, Loader2, RefreshCw, Search } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';
import { Select } from '@/components/ui/select';

import { type CmsEntry, type CmsFieldDefinition, getCmsEntry, getCmsLocales } from '@/lib/modules/cms/client';
import {
  DESCRIPTION_IDEAL_MAX,
  DESCRIPTION_IDEAL_MIN,
  SEO_FIELD_KEY,
  SERP_TITLE_MAX,
  TITLE_MIN,
  hasSeoBlock,
  plainText,
  seoChecklist,
  seoSnapshot,
} from '@/lib/utils/cms-seo';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { DumaSays } from './DumaSays';
import { cmsKeys } from './shared';

/** Content's writing help, through the CRM's own server route (the provider keys live there). */
export async function assist<T extends object>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/cms/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? 'Writing help is unavailable right now.');
  return json;
}

const TEXT_TYPES = new Set(['text', 'longText', 'richText']);
const SUMMARY_KEYS = /^(summary|excerpt|intro|teaser|description|standfirst)$/i;

/** All of an entry's prose, as plain text, for the model to read. */
function entryText(fields: readonly CmsFieldDefinition[], data: Record<string, unknown>) {
  return fields
    .filter((field) => (field.type === 'richText' || field.type === 'longText') && typeof data[field.key] === 'string')
    .map((field) => plainText(data[field.key] as string))
    .join('\n\n');
}

/**
 * Suggestions that fill the form, never the record: the editor reads what came
 * back, changes it if they like, and saves. Each action only appears when the
 * model has somewhere to put its result.
 */
export function AssistSection({
  entry,
  fields,
  titleField,
  data,
  pageUrl,
  onChange,
  onKeyword,
  fillSeoRequest = 0,
}: {
  entry: CmsEntry;
  fields: CmsFieldDefinition[];
  titleField: string | null;
  data: Record<string, unknown>;
  /** The page's address on the site, for the canonical URL. */
  pageUrl: string | null;
  onChange: (next: Record<string, unknown>) => void;
  /** The focus keyword the AI chose, for the checklist. */
  onKeyword: (keyword: string) => void;
  /** Bumped by another card (Search & sharing's Fix) to run Fill SEO here. */
  fillSeoRequest?: number;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [busy, setBusy] = useState<string | null>(null);
  const [saying, setSaying] = useState<null | { tone: 'done' | 'error'; text: string }>(null);
  // Bumped on each success so the mascot celebrates every time, not just the first.
  const [cheer, setCheer] = useState(0);
  // A "done" line has said its piece after a few seconds; then the bubble goes back to what's next.
  useEffect(() => {
    if (saying?.tone !== 'done') return;
    const timer = setTimeout(() => setSaying(null), 6000);
    return () => clearTimeout(timer);
  }, [saying]);
  const others = (entry.localizations ?? []).filter((version) => version.id !== entry.id);
  const [source, setSource] = useState(others[0]?.id ?? '');
  const locales = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId && others.length > 0,
  });
  const languageName = (code: string) => locales.data?.find((locale) => locale.code === code)?.name ?? code;

  const summaryField = fields.find((field) => SUMMARY_KEYS.test(field.key) && (field.type === 'longText' || field.type === 'text'));
  const title = titleField && typeof data[titleField] === 'string' ? (data[titleField] as string) : '';
  const text = entryText(fields, data);

  /** Run one action; its outcome is what the mascot says next. */
  async function run(label: string, work: () => Promise<string>) {
    setBusy(label);
    setSaying(null);
    try {
      setSaying({ tone: 'done', text: await work() });
      setCheer((count) => count + 1);
    } catch (error) {
      setSaying({ tone: 'error', text: error instanceof Error ? error.message : 'That didn’t work — try again.' });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Fill the SEO block the way the checklist wants it: fields that are empty
   * or fail a best-practice check get the AI's version (already fitted to the
   * limits by the server); fields that pass are left alone unless `rewrite`.
   * The image and canonical are filled from the entry, not invented.
   */
  const fillSeo = (rewrite = false) =>
    run('seo', async () => {
      const result = await assist<{
        seo: {
          focusKeyword: string;
          relatedKeywords: string[];
          metaTitle: string;
          metaDescription: string;
          socialTitle: string;
          socialDescription: string;
          schemaType: string;
        };
      }>({
        task: 'seo',
        title,
        text,
        kind: entry.contentType?.name,
      });
      const seo = (data[SEO_FIELD_KEY] && typeof data[SEO_FIELD_KEY] === 'object' ? data[SEO_FIELD_KEY] : {}) as Record<string, unknown>;
      const own = (key: string) => (typeof seo[key] === 'string' ? (seo[key] as string).trim() : '');
      const titleOk = own('metaTitle').length >= TITLE_MIN && own('metaTitle').length <= SERP_TITLE_MAX;
      const description = own('metaDescription');
      const descriptionOk =
        description.length >= DESCRIPTION_IDEAL_MIN && description.length <= DESCRIPTION_IDEAL_MAX && /[.!?]["”’)]?$/.test(description);
      const next: Record<string, unknown> = { ...seo };
      const changed: string[] = [];
      if (rewrite || !titleOk) {
        next.metaTitle = result.seo.metaTitle;
        changed.push('title');
      }
      if (rewrite || !descriptionOk) {
        next.metaDescription = result.seo.metaDescription;
        changed.push('description');
      }
      // The newer sub-fields only exist on an up-to-date block; fill those it has, when empty.
      const block = new Set((fields.find((field) => field.key === SEO_FIELD_KEY)?.fields ?? []).map((field) => field.key));
      const offer = (key: string, value: string, label: string) => {
        if (!block.has(key) || !value || (!rewrite && own(key))) return;
        next[key] = value;
        changed.push(label);
      };
      offer('focusKeyword', result.seo.focusKeyword, 'focus keyword');
      offer('relatedKeywords', result.seo.relatedKeywords.join(', '), 'related keywords');
      offer('socialTitle', result.seo.socialTitle, 'social title');
      offer('socialDescription', result.seo.socialDescription, 'social description');
      offer('schemaType', result.seo.schemaType, 'content type');
      if (!seo.ogImage) {
        const image = fields.find((field) => field.type === 'media' && field.key !== SEO_FIELD_KEY && data[field.key]);
        const value = image ? data[image.key] : null;
        const first = Array.isArray(value) ? value[0] : value;
        if (typeof first === 'string') {
          next.ogImage = first;
          changed.push('social image');
        }
      }
      if (!own('canonicalUrl') && pageUrl && /^https:\/\//i.test(pageUrl)) {
        next.canonicalUrl = pageUrl;
        changed.push('canonical URL');
      }
      onKeyword(result.seo.focusKeyword);
      onChange({ ...data, [SEO_FIELD_KEY]: next });
      return changed.length > 0 ? 'SEO filled in — have a look, then save.' : 'Your SEO already looks good.';
    });

  // A Fix in Search & sharing asks for Fill SEO; run it here so the mascot reacts.
  const handled = useRef(fillSeoRequest);
  useEffect(() => {
    if (fillSeoRequest === handled.current) return;
    handled.current = fillSeoRequest;
    if (!busy) void fillSeo();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new request triggers it
  }, [fillSeoRequest]);

  const summarise = () =>
    run('summary', async () => {
      const result = await assist<{ text: string }>({ task: 'summary', text });
      onChange({ ...data, [summaryField!.key]: summaryField!.type === 'text' ? result.text.replace(/\s+/g, ' ') : result.text });
      return 'Summary written — have a look, then save.';
    });

  const translate = () =>
    run('translate', async () => {
      const from = await getCmsEntry(source, tenantId ?? undefined);
      // Only top-level prose fields: slugs, links and media stay as they are.
      const textFields = fields.filter((field) => TEXT_TYPES.has(field.type));
      const input = Object.fromEntries(
        textFields.map((field) => [field.key, from.draftData[field.key]]).filter(([, value]) => typeof value === 'string' && value.trim()),
      );
      const result = await assist<{ fields: Record<string, string> }>({
        task: 'translate',
        fields: input,
        from: languageName(from.locale),
        to: languageName(entry.locale),
      });
      onChange({ ...data, ...result.fields });
      return 'Translated — have a look, then save.';
    });

  const actions = [hasSeoBlock(fields), Boolean(summaryField), others.length > 0].filter(Boolean).length;
  // What Fill SEO can actually fix (wording and type) — image alt text and indexing are the editor's call.
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
  const seoToFix = hasSeoBlock(fields)
    ? seoChecklist(seoSnapshot(fields, titleField, data)).filter((check) => !check.ok && AI_FIXABLE.has(check.id)).length
    : 0;
  const empty = !text && !title;

  /**
   * Fields Fill SEO would fill that are still empty, beyond the failing checks:
   * the optional social and keyword fields, the image when the entry has one,
   * the canonical when the page has an https address. Zero, with nothing to
   * fix, means there is nothing left for it to do.
   */
  const seoEmpty = (() => {
    const seoField = fields.find((field) => field.key === SEO_FIELD_KEY);
    if (!seoField) return 0;
    const seo = (data[SEO_FIELD_KEY] && typeof data[SEO_FIELD_KEY] === 'object' ? data[SEO_FIELD_KEY] : {}) as Record<string, unknown>;
    const blank = (key: string) => !(typeof seo[key] === 'string' ? (seo[key] as string).trim() : seo[key]);
    const has = new Set((seoField.fields ?? []).map((field) => field.key));
    const optional = ['relatedKeywords', 'socialTitle', 'socialDescription'].filter((key) => has.has(key) && blank(key)).length;
    const image =
      blank('ogImage') && fields.some((field) => field.type === 'media' && field.key !== SEO_FIELD_KEY && data[field.key]) ? 1 : 0;
    const canonical = blank('canonicalUrl') && pageUrl && /^https:\/\//i.test(pageUrl) ? 1 : 0;
    return optional + image + canonical;
  })();
  const seoDone = seoToFix === 0 && seoEmpty === 0;
  const line = busy ? 'Writing…' : saying ? saying.text : suggestion();

  /** What is most worth doing next, asked as a question — or that all is well. */
  function suggestion(): string {
    if (actions === 0) return 'Add an SEO block or a Summary field to the model and I can help here.';
    if (empty)
      return others.length > 0
        ? `Empty here — shall I translate it from ${languageName(others[0]!.locale)}?`
        : 'Write a little first, then I can help.';
    if (seoToFix > 0)
      return `SEO has ${seoToFix} ${seoToFix === 1 ? 'thing' : 'things'} to fix — want me to sort ${seoToFix === 1 ? 'it' : 'them'}?`;
    if (seoEmpty > 0) return `SEO passes — want me to fill the ${seoEmpty} empty ${seoEmpty === 1 ? 'field' : 'fields'} too?`;
    if (summaryField && !(typeof data[summaryField.key] === 'string' && (data[summaryField.key] as string).trim()))
      return 'No summary yet — shall I write one?';
    return hasSeoBlock(fields) ? 'All good — SEO passes every check.' : 'All set here.';
  }

  return (
    <div className="space-y-3">
      <DumaSays line={line} busy={Boolean(busy)} tone={saying?.tone ?? 'idle'} cheer={cheer} />

      {actions > 0 && (
        <div className="grid gap-1.5">
          {/* Full-width rows: the aside is narrow, so a wrapping row of buttons only leaves ragged gaps. */}
          {hasSeoBlock(fields) && (
            <span className="flex">
              <Action
                icon={Search}
                busy={busy === 'seo'}
                disabled={!!busy || empty || seoDone}
                tip={
                  seoToFix > 0
                    ? 'Fill and fix the SEO fields to best practice'
                    : seoEmpty > 0
                      ? 'SEO passes — fill the remaining empty fields'
                      : 'SEO passes and every field is filled — use ↻ for fresh wording'
                }
                onClick={() => void fillSeo()}
                joined
              >
                Fill SEO
                {seoToFix > 0 ? (
                  <span className="ml-auto rounded-sm bg-measured/12 px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums text-measured">
                    {seoToFix} to fix
                  </span>
                ) : seoEmpty > 0 ? (
                  <span className="ml-auto rounded-sm bg-band px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                    {seoEmpty} to fill
                  </span>
                ) : (
                  <CheckCircle2 size={13} className="ml-auto text-momentum" aria-label="All good" />
                )}
              </Action>
              <Tooltip side="top" label="Rewrite every SEO field">
                <button
                  type="button"
                  aria-label="Rewrite every SEO field"
                  disabled={!!busy || empty}
                  onClick={() => void fillSeo(true)}
                  className="flex h-9 items-center rounded-r-md border border-rule bg-control px-2.5 text-muted-foreground transition-colors hover:bg-band/50 hover:text-foreground disabled:opacity-45"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                </button>
              </Tooltip>
            </span>
          )}
          {summaryField && (
            <Action
              icon={AlignLeft}
              busy={busy === 'summary'}
              disabled={!!busy || !text}
              tip={`Two or three sentences into “${summaryField.label}”`}
              onClick={() => void summarise()}
            >
              Write summary
            </Action>
          )}
          {others.length === 1 && (
            <Action
              icon={Languages}
              busy={busy === 'translate'}
              disabled={!!busy}
              tip={`Text fields from the ${languageName(others[0]!.locale)} version into ${languageName(entry.locale)}`}
              onClick={() => void translate()}
            >
              Translate from {languageName(others[0]!.locale)}
            </Action>
          )}
        </div>
      )}
      {others.length > 1 && (
        <div className="flex gap-1.5">
          <Select
            ariaLabel="Translate from"
            className="min-w-0 flex-1"
            value={source}
            onValueChange={setSource}
            options={others.map((version) => ({ value: version.id, label: `From ${languageName(version.locale)}` }))}
          />
          <Action
            icon={Languages}
            busy={busy === 'translate'}
            disabled={!!busy || !source}
            tip={`Text fields into ${languageName(entry.locale)}`}
            onClick={() => void translate()}
          >
            Translate
          </Action>
        </div>
      )}
    </div>
  );
}

/** One action: icon and a short label, the detail in the app's tooltip. */
function Action({
  icon: Icon,
  busy,
  disabled,
  tip,
  onClick,
  joined = false,
  children,
}: {
  icon: IconComponent;
  busy: boolean;
  disabled: boolean;
  tip: string;
  onClick: () => void;
  /** Its right side joins a following button (Fill SEO + rewrite). */
  joined?: boolean;
  children: React.ReactNode;
}) {
  return (
    // The tooltip wraps the button so it still shows when the button is disabled.
    <Tooltip side="top" label={tip} className="min-w-0 flex-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'flex h-9 w-full items-center gap-2 border border-rule bg-control px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-45 disabled:hover:border-rule disabled:hover:bg-control',
          // Joined: the divider belongs to the next button, so it stays crisp when this one is disabled.
          joined ? 'rounded-l-md border-r-0' : 'rounded-md',
        )}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
        ) : (
          <Icon size={14} className="text-primary" aria-hidden="true" />
        )}
        {children}
      </button>
    </Tooltip>
  );
}
