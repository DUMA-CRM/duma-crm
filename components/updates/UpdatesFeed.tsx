'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Megaphone } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';

import { getUpdate, getUpdates, recordUpdate, updateKeys } from '@/lib/modules/identity/client';
import { useAuthStore } from '@/stores/authStore';

import { UpdateArticle } from './UpdateArticle';

export function UpdatesFeed({ id }: { id?: string }) {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: [...updateKeys.all, user?.id, 'feed', page], queryFn: () => getUpdates(page), enabled: !!user && !id });
  const detail = useQuery({ queryKey: [...updateKeys.all, user?.id, 'post', id], queryFn: () => getUpdate(id!), enabled: !!user && !!id });
  const read = useMutation({
    mutationFn: ({ updateId, announcement }: { updateId: string; announcement: number }) => recordUpdate(updateId, announcement, 'read'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: updateKeys.all });
    },
  });
  const markRead = read.mutate;
  const announcement = detail.data?.announcement;
  useEffect(() => {
    if (announcement !== undefined && id) markRead({ updateId: id, announcement });
  }, [id, announcement, markRead]); // receipt is independent of query refreshes
  const query = id ? detail : list;
  return (
    <EditorShell
      title="What's new"
      icon={<Megaphone size={20} />}
      actions={
        role === 'super_admin' ? (
          <Button asChild variant="outline">
            <Link href="/content?tab=updates">Manage updates</Link>
          </Button>
        ) : undefined
      }
    >
      {id && (
        <Link href="/updates" className="mb-6 inline-block text-sm text-primary hover:underline">
          All updates
        </Link>
      )}
      {query.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading updates…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="space-y-3">
          <p>Updates could not be loaded. Check your connection and try again.</p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {id && detail.data && <UpdateArticle content={detail.data} publishedAt={detail.data.publishedAt} />}
      {id && read.isError && (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Your read status could not be saved.{' '}
          <button className="underline" onClick={() => detail.data && markRead({ updateId: id, announcement: detail.data.announcement })}>
            Try again
          </button>
        </p>
      )}
      {!id && list.data && (
        <div className="mx-auto w-full max-w-3xl">
          {!list.data.data.length && (
            <div className="py-12">
              <h2 className="text-lg font-semibold">You’re up to date</h2>
              <p className="mt-2 text-sm text-muted-foreground">New features and improvements will appear here.</p>
            </div>
          )}
          <div className="divide-y divide-rule">
            {list.data.data.map((post) => (
              <Link
                key={post.id}
                href={`/updates/${post.id}`}
                className="block space-y-2 py-6 hover:bg-band/40 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </time>
                  {post.unread && <span className="font-medium text-primary">Unread</span>}
                </div>
                <h2 className="text-xl font-semibold">{post.title}</h2>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
              </Link>
            ))}
          </div>
          {(page > 0 || list.data.hasMore) && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Newer updates
              </Button>
              <span className="text-sm">Page {page + 1}</span>
              <Button variant="outline" disabled={!list.data.hasMore} onClick={() => setPage(page + 1)}>
                Older updates
              </Button>
            </div>
          )}
        </div>
      )}
    </EditorShell>
  );
}
