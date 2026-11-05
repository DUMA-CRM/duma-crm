'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { LABELS, type Platform, connections, disconnect, marketingKey, startConnect } from '@/lib/modules/marketing/client';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function SocialConnector({ provider, onClose }: { provider: Platform; onClose: () => void }) {
  const tid = useWorkspaceStore((s) => s.tenantId),
    client = useQueryClient(),
    search = useSearchParams();
  const [removing, setRemoving] = useState<string | null>(null);
  const canWrite = hasCapability(
    useAuthStore((s) => s.capabilities),
    'marketing.connections:write',
  );
  const q = useQuery({ queryKey: marketingKey(tid, 'connections'), queryFn: connections });
  const connect = useMutation({ mutationFn: () => startConnect(provider), onSuccess: (r) => window.location.assign(r.url) });
  const remove = useMutation({
    mutationFn: disconnect,
    onSuccess: () => {
      setRemoving(null);
      void client.invalidateQueries({ queryKey: marketingKey(tid) });
    },
  });
  const config = q.data?.providers.find((p) => p.provider === provider);
  // Back from the provider (the API's callback lands here): say how it went on
  // the list, as Google Drive does, rather than on this page.
  const router = useRouter();
  const outcome = search.get('oauth');
  useEffect(() => {
    if (!outcome) return;
    if (outcome === 'connected') toast('success', `${LABELS[provider]} connected. Choose it as a destination on any post.`);
    else toast('error', `${LABELS[provider]} didn’t connect. Check the account type and permissions, then try again.`);
    void client.invalidateQueries({ queryKey: marketingKey(tid) });
    router.replace('/settings/connectors');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the redirect
  }, []);
  return (
    <EditorShell title={LABELS[provider]} eyebrow="Marketing connection" onClose={onClose}>
      <div className="mx-auto max-w-3xl space-y-6 py-6">
        <p className="text-sm text-muted-foreground">
          Connect the accounts your workspace uses to publish social posts. Each post shows its selected destination before scheduling.
        </p>
        {q.isPending ? (
          <p>Checking connection…</p>
        ) : q.error ? (
          <ErrorState title="Could not load connections" onRetry={() => void q.refetch()} />
        ) : (
          <>
            {!config?.configured && (
              <div className="rounded-lg border border-rule bg-band p-4 text-sm">
                This connector needs setup by your DUMA administrator before you can sign in.
              </div>
            )}
            {provider === 'instagram' && <p className="text-sm">Use an Instagram professional account (Business or Creator).</p>}
            {provider === 'facebook' && <p className="text-sm">Sign in with access to the Facebook Pages you want to publish to.</p>}
            {provider === 'tiktok' && !config?.directPost && (
              <p className="rounded-lg border border-rule p-4 text-sm">
                TikTok automatic publishing is awaiting provider approval. You can connect your account and prepare drafts; scheduling
                becomes available after approval.
              </p>
            )}
            <div className="space-y-3">
              {q.data?.accounts
                .filter((a) => a.provider === provider)
                .map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-rule p-4">
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.remoteId}</p>
                      <Badge variant={a.state === 'connected' ? 'success' : 'muted'}>{a.state}</Badge>
                    </div>
                    {canWrite && a.state !== 'disconnected' && (
                      <Button variant="outline" onClick={() => setRemoving(a.id)}>
                        Disconnect
                      </Button>
                    )}
                  </div>
                ))}
            </div>
            {canWrite && (
              <Button disabled={!config?.configured || connect.isPending} onClick={() => connect.mutate()}>
                {connect.isPending ? 'Opening sign-in…' : `Connect ${LABELS[provider]} account`}
              </Button>
            )}
          </>
        )}
        {connect.error && (
          <p role="alert" className="text-destructive">
            {connect.error.message}
          </p>
        )}
        {remove.error && (
          <p role="alert" className="text-destructive">
            {remove.error.message}
          </p>
        )}
      </div>
      {removing && (
        <ConfirmModal
          title="Disconnect account?"
          message="Queued posts for this account will be blocked. Drafts and publishing history remain. You can also remove DUMA’s authorization in the provider’s account settings."
          confirmLabel="Disconnect"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </EditorShell>
  );
}
