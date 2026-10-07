'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import { FileText, UploadCloud } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { getCmsContentTypes, getCmsLocales, importCmsEntries } from '@/lib/modules/cms/client';
import {
  type HtmlNode,
  WORDPRESS_COLUMNS,
  autoMap,
  htmlToMarkdown,
  importableFields,
  isImportablePost,
  parseCsv,
  rowsToEntries,
  wordPressRow,
} from '@/lib/utils/cms-import';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { cmsKeys, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

const BATCH = 200;

/** A WordPress export (Tools → Export → All content) to rows, with each post's HTML turned into Markdown. */
function parseWordPress(xml: string): string[][] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('That isn’t a readable WordPress export file.');
  const text = (item: Element, tag: string) => item.getElementsByTagName(tag)[0]?.textContent ?? '';
  return Array.from(doc.getElementsByTagName('item'))
    .filter((item) => isImportablePost(text(item, 'wp:post_type'), text(item, 'wp:status')))
    .map((item) => {
      const html = new DOMParser().parseFromString(text(item, 'content:encoded'), 'text/html');
      return wordPressRow({
        title: text(item, 'title'),
        slug: text(item, 'wp:post_name'),
        content: htmlToMarkdown(html.body as unknown as HtmlNode),
        excerpt: text(item, 'excerpt:encoded'),
        date: text(item, 'wp:post_date_gmt') || text(item, 'wp:post_date'),
        status: text(item, 'wp:status'),
        categories: Array.from(item.getElementsByTagName('category'))
          .filter((category) => category.getAttribute('domain') === 'category')
          .map((category) => category.textContent ?? ''),
      });
    });
}

/**
 * Bring content in from a CSV file or a WordPress export: pick the file, the
 * model and the language, match columns to fields (pre-matched by name), check
 * the preview, import. Entries arrive as drafts unless you choose to publish.
 */
export function ImportDialog({ initialTypeId, onClose }: { initialTypeId?: string; onClose: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const fileInput = useRef<HTMLInputElement>(null);
  const types = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const locales = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const [source, setSource] = useState<{ name: string; kind: 'csv' | 'wordpress'; headers: string[]; rows: string[][] } | null>(null);
  const [typeId, setTypeId] = useState(initialTypeId ?? '');
  const [locale, setLocale] = useState('');
  const [mapping, setMapping] = useState<string[]>([]);
  const [publish, setPublish] = useState(false);
  const [progress, setProgress] = useState<null | { done: number; total: number }>(null);
  const [result, setResult] = useState<null | { created: number; failed: Array<{ row: number; error: string }> }>(null);

  const type = types.data?.find((candidate) => candidate.id === (typeId || types.data?.[0]?.id));
  const fields = useMemo(() => (type ? importableFields(type.fields) : []), [type]);
  const entries = useMemo(() => (source && type ? rowsToEntries(source.rows, mapping, type.fields) : []), [source, type, mapping]);
  const activeLocale = locale || locales.data?.find((row) => row.isDefault)?.code || '';

  async function readFile(file: File) {
    try {
      const text = await file.text();
      const wordpress = /\.xml$/i.test(file.name) || text.trimStart().startsWith('<?xml');
      const table = wordpress ? [[...WORDPRESS_COLUMNS], ...parseWordPress(text)] : parseCsv(text);
      const [headers = [], ...rows] = table;
      if (rows.length === 0) throw new Error('The file has no rows to import.');
      setSource({ name: file.name, kind: wordpress ? 'wordpress' : 'csv', headers, rows });
      if (type) setMapping(autoMap(headers, type.fields));
      setResult(null);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'The file couldn’t be read.');
    }
  }

  async function run() {
    if (!type || entries.length === 0) return;
    setProgress({ done: 0, total: entries.length });
    let created = 0;
    const failed: Array<{ row: number; error: string }> = [];
    try {
      for (let start = 0; start < entries.length; start += BATCH) {
        const batch = entries.slice(start, start + BATCH);
        const response = await importCmsEntries(
          { contentTypeId: type.id, locale: activeLocale || undefined, publish, entries: batch },
          tenantId ?? undefined,
        );
        created += response.created.length;
        for (const failure of response.failed) {
          const detail = failure.issues?.[0] ? `${failure.issues[0].field}: ${failure.issues[0].message}` : failure.error;
          failed.push({ row: start + failure.index + 2, error: detail });
        }
        setProgress({ done: Math.min(entries.length, start + BATCH), total: entries.length });
      }
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'The import stopped.');
    } finally {
      invalidateCms(queryClient);
      setProgress(null);
      setResult({ created, failed });
    }
  }

  const sample = (column: number) => source?.rows.find((row) => row[column]?.trim())?.[column] ?? '';

  return (
    <Modal
      title="Import entries"
      description="From a CSV file or a WordPress export (Tools → Export). Entries arrive as drafts unless you choose to publish."
      size="2xl"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {progress
              ? `Importing… ${progress.done} of ${progress.total}`
              : source
                ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} ready`
                : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {result ? 'Done' : 'Cancel'}
            </Button>
            {!result && (
              <Button disabled={!source || !type || entries.length === 0 || progress !== null} onClick={() => void run()}>
                {progress ? 'Importing…' : `Import ${entries.length || ''} ${publish ? 'and publish' : 'as drafts'}`.replace('  ', ' ')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.xml,text/csv,application/xml,text/xml"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void readFile(file);
        }}
      />

      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold tabular-nums">{result.created}</span> {result.created === 1 ? 'entry' : 'entries'} created
            {result.failed.length > 0 && (
              <>
                , <span className="font-semibold tabular-nums text-measured">{result.failed.length}</span> not
              </>
            )}
            .
          </p>
          {result.failed.length > 0 && (
            <ul className="max-h-64 divide-y divide-rule/40 overflow-auto rounded-lg border border-rule/60 text-xs">
              {result.failed.map((failure) => (
                <li key={`${failure.row}-${failure.error}`} className="flex gap-3 px-3 py-2">
                  <span className="shrink-0 tabular-nums text-muted-foreground">Row {failure.row}</span>
                  <span className="text-foreground">{failure.error}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem]">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-dashed px-3.5 py-3 text-left transition-colors hover:bg-band/40',
                source ? 'border-rule' : 'border-primary/60',
              )}
            >
              {source ? (
                <FileText size={18} className="shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <UploadCloud size={18} className="shrink-0 text-primary" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{source ? source.name : 'Choose a file'}</span>
                <span className="block text-xs text-muted-foreground">
                  {source ? `${source.kind === 'wordpress' ? 'WordPress' : 'CSV'} · ${source.rows.length} rows` : '.csv or WordPress .xml'}
                </span>
              </span>
            </button>
            <div className="space-y-1">
              <p className="text-label uppercase text-muted-foreground">Into model</p>
              <Select
                ariaLabel="Content model"
                className="w-full"
                value={type?.id ?? ''}
                onValueChange={(value) => {
                  setTypeId(value);
                  const next = types.data?.find((candidate) => candidate.id === value);
                  if (source && next) setMapping(autoMap(source.headers, next.fields));
                }}
                options={(types.data ?? [])
                  .filter((candidate) => candidate.kind === 'collection')
                  .map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              />
            </div>
            <div className="space-y-1">
              <p className="text-label uppercase text-muted-foreground">Language</p>
              <Select
                ariaLabel="Language"
                className="w-full"
                value={activeLocale}
                onValueChange={setLocale}
                options={(locales.data ?? []).map((row) => ({ value: row.code, label: row.name }))}
              />
            </div>
          </div>

          {source && type && (
            <div>
              <p className="mb-1.5 text-label uppercase text-muted-foreground">Match columns to fields</p>
              <div className="max-h-[40vh] overflow-auto rounded-lg border border-rule/60">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-band/70 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Column</th>
                      <th className="px-3 py-2 font-medium">Example</th>
                      <th className="w-56 px-3 py-2 font-medium">Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule/40">
                    {source.headers.map((header, column) => (
                      <tr key={`${header}-${column}`}>
                        <td className="px-3 py-2 font-medium text-foreground">{header || `Column ${column + 1}`}</td>
                        <td className="max-w-64 truncate px-3 py-2 text-xs text-muted-foreground">{sample(column).slice(0, 120)}</td>
                        <td className="px-3 py-1.5">
                          <Select
                            ariaLabel={`Field for ${header}`}
                            className="w-full"
                            value={mapping[column] ?? ''}
                            onValueChange={(value) =>
                              setMapping((current) =>
                                current.map((key, index) => (index === column ? value : key === value && value ? '' : key)),
                              )
                            }
                            options={[{ value: '', label: 'Skip' }, ...fields.map((field) => ({ value: field.key, label: field.label }))]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {source.kind === 'wordpress'
                  ? 'Post content is converted to Markdown. Images stay linked to your old site — upload them to Media to keep them if it goes away.'
                  : 'Numbers, yes/no, dates and lists (separated by ; ) are converted to match each field.'}
              </p>
            </div>
          )}

          {source && access.canPublish && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={publish}
                onChange={(event) => setPublish(event.target.checked)}
              />
              Publish each entry that passes validation (the rest stay as drafts)
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}
