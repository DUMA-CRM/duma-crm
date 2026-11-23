'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';

import { Search, ShieldCheck, Users } from '@/components/icons';
import { Avatar } from '@/components/shared/Avatar';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type PlatformUser, type UserDirectoryFilters, getPlatformUsers } from '@/lib/api/platform.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { accountStatus, signInMethodLabel } from '@/lib/utils/platform-users';

export const platformUsersKey = moduleQueryKeys.identity.key('platform-users');

const FILTERS = {
  status: [
    { value: 'all', label: 'Any status' },
    { value: 'active', label: 'Not suspended' },
    { value: 'suspended', label: 'Suspended' },
  ],
  verification: [
    { value: 'all', label: 'Any email' },
    { value: 'verified', label: 'Email verified' },
    { value: 'unverified', label: 'Email unverified' },
  ],
  membership: [
    { value: 'all', label: 'Any workspace' },
    { value: 'member', label: 'In a workspace' },
    { value: 'none', label: 'No workspace' },
  ],
  sort: [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'last_sign_in', label: 'Last signed in' },
    { value: 'name', label: 'Name A–Z' },
  ],
} as const;

const DEFAULTS: UserDirectoryFilters = { q: '', status: 'all', verification: 'all', membership: 'all', sort: 'newest' };

function UserRow({ user }: { user: PlatformUser }) {
  const status = accountStatus(user);
  return (
    <ListRow
      href={`/admin/users/${encodeURIComponent(user.id)}`}
      leading={<Avatar name={user.name} email={user.email} size="md" />}
      title={user.name}
      titleExtra={user.platformAdmin && <Badge variant="reference"><ShieldCheck aria-hidden="true" />DUMA Admin</Badge>}
      meta={
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          <span className="truncate">{user.email}</span>
          <span aria-hidden="true">·</span>
          <span>{user.workspace ?? 'No workspace'}{user.workspaceCount > 1 && ` +${user.workspaceCount - 1}`}</span>
          {user.providers.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{user.providers.map(signInMethodLabel).join(', ')}</span>
            </>
          )}
        </span>
      }
      trailing={
        <span className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground md:inline">
            {user.lastSignInAt ? <>Signed in <RelativeTime iso={user.lastSignInAt} /></> : 'No sign-in recorded'}
          </span>
          {!user.emailVerified && <Badge variant="warning">Unverified</Badge>}
          {status.label !== 'Active' && <Badge variant={status.tone}>{status.label}</Badge>}
        </span>
      }
    />
  );
}

/**
 * DUMA Admin → Users: every account on the platform, workspace staff or not.
 * A row opens the account; everything you can do to it lives there.
 */
export function AdminUsers() {
  const [filters, setFilters] = useState(DEFAULTS);
  const [page, setPage] = useState(1);
  const q = useDeferredValue(filters.q.trim());
  const query = { ...filters, q };
  const directory = useQuery({
    queryKey: [...platformUsersKey, query, page],
    queryFn: ({ signal }) => getPlatformUsers(query, page, signal),
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });
  const set = <K extends keyof UserDirectoryFilters>(key: K, value: UserDirectoryFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const filtered = JSON.stringify({ ...filters, sort: 'newest' }) !== JSON.stringify(DEFAULTS);
  const data = directory.data;
  const first = data ? (page - 1) * data.pageSize + 1 : 0;

  return (
    <EditorShell
      eyebrow="DUMA Admin"
      title="Users"
      icon={<Users size={18} aria-hidden="true" />}
      meta={data && <span className="text-sm text-muted-foreground tabular-nums">{data.total.toLocaleString()} {data.total === 1 ? 'account' : 'accounts'}</span>}
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-60 flex-1">
            <Input
              type="search"
              aria-label="Search by name, email or user ID"
              placeholder="Search by name, email or user ID"
              leftIcon={<Search size={14} aria-hidden="true" />}
              value={filters.q}
              maxLength={320}
              onChange={(event) => set('q', event.target.value)}
            />
          </div>
          {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((key) => (
            <Select
              key={key}
              ariaLabel={key === 'sort' ? 'Sort by' : `Filter by ${key}`}
              className="w-auto min-w-36"
              value={filters[key]}
              options={[...FILTERS[key]]}
              onValueChange={(value) => set(key, value as never)}
            />
          ))}
        </div>

        {directory.isPending ? (
          <ListSkeleton rows={8} label="Loading users" />
        ) : directory.isError && !data ? (
          <ErrorState title="Users couldn’t be loaded" description={directory.error.message} onRetry={() => void directory.refetch()} />
        ) : data!.users.length === 0 ? (
          <EmptyState
            icon={Users}
            kind={filtered ? 'search' : 'start'}
            title={filtered ? 'No accounts match' : 'No accounts yet'}
            description={filtered ? 'Try a different search or clear the filters.' : undefined}
            action={filtered ? { label: 'Clear filters', onClick: () => { setFilters(DEFAULTS); setPage(1); } } : undefined}
          />
        ) : (
          <>
            <ListRowGroup aria-busy={directory.isPlaceholderData} className={directory.isPlaceholderData ? 'opacity-60' : undefined}>
              {data!.users.map((user) => <UserRow key={user.id} user={user} />)}
            </ListRowGroup>
            <nav aria-label="User directory pages" className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground tabular-nums">
                {first.toLocaleString()}–{(first + data!.users.length - 1).toLocaleString()} of {data!.total.toLocaleString()}
              </span>
              {(page > 1 || data!.hasNext) && (
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={!data!.hasNext} onClick={() => setPage(page + 1)}>Next</Button>
                </span>
              )}
            </nav>
          </>
        )}
      </div>
    </EditorShell>
  );
}
