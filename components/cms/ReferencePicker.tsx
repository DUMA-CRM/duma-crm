'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { FileText, Search } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { LoadingState } from '@/components/shared/Skeleton';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getCmsContentTypes, getCmsEntries } from '@/lib/modules/cms/client';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { EntryStatusBadge, PanelError, cmsKeys } from './shared';

/**
 * Pick an entry to link to. A reference stores the document id, so the link
 * follows the reader's locale on the website; the list shows the editor's.
 */
export function ReferencePicker({
  allowedTypeKeys,
  exclude,
  locale,
  onPick,
  onClose,
}: {
  allowedTypeKeys?: string[];
  exclude: string[];
  locale: string;
  onPick: (documentId: string) => void;
  onClose: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const allowed = (typesQuery.data ?? []).filter(
    (type) => !allowedTypeKeys || allowedTypeKeys.length === 0 || allowedTypeKeys.includes(type.key),
  );
  const [typeId, setTypeId] = useState('');
  const activeTypeId = typeId || allowed[0]?.id || '';

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = { contentTypeId: activeTypeId, locale, q: q || undefined };
  const entriesQuery = useQuery({
    queryKey: cmsKeys.entries(tenantId, filters),
    queryFn: () => getCmsEntries(filters, tenantId ?? undefined),
    enabled: !!tenantId && !!activeTypeId,
  });
  const rows = (entriesQuery.data?.data ?? []).filter((row) => !exclude.includes(row.documentId));

  return (
    <Modal title="Link an entry" onClose={onClose} size="lg">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-48 flex-1">
          <Input
            aria-label="Search entries"
            placeholder="Search"
            leftIcon={<Search size={14} aria-hidden="true" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {allowed.length > 1 && (
          <Select
            ariaLabel="Content type"
            className="w-48"
            value={activeTypeId}
            onValueChange={setTypeId}
            options={allowed.map((type) => ({ value: type.id, label: type.name }))}
          />
        )}
      </div>
      <div className="mt-3 max-h-[50vh] overflow-y-auto">
        {typesQuery.isPending || (entriesQuery.isPending && !!activeTypeId) ? (
          <LoadingState label="Loading entries" compact />
        ) : entriesQuery.isError ? (
          <PanelError title="Entries couldn’t be loaded" onRetry={() => void entriesQuery.refetch()} />
        ) : allowed.length === 0 ? (
          <EmptyState
            compact
            icon={FileText}
            title="No linkable content types"
            description="This field only links to types that do not exist yet."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={FileText}
            kind={q ? 'search' : 'start'}
            title={q ? 'Nothing matches' : `No ${locale} entries to link`}
          />
        ) : (
          <ul className="divide-y divide-rule/50 rounded-lg border border-rule/60">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onPick(row.documentId)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.title ?? 'Untitled'}</span>
                    {row.slug && <span className="block truncate font-mono text-xs text-muted-foreground">/{row.slug}</span>}
                  </span>
                  <EntryStatusBadge status={row.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
