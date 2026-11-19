'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { approveChatGptAction, getChatGptActionApproval, type ChatGptActionApproval } from '@/lib/api/auth.service';
import { ApiError } from '@/lib/api/client';

function ActionApproval() {
  const id = useSearchParams().get('id') ?? '';
  const [request, setRequest] = useState<ChatGptActionApproval>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!id) return;
    let current = true;
    void getChatGptActionApproval(id).then(
      (result) => { if (current) setRequest(result); },
      (failure: unknown) => {
        if (!current) return;
        if (failure instanceof ApiError && failure.status === 401) {
          const next = '/connect/chatgpt/approve?' + new URLSearchParams({ id });
          window.location.replace('/sign-in?' + new URLSearchParams({ next }));
          return;
        }
        setError(failure instanceof Error ? failure.message : 'This request is unavailable.');
      },
    );
    return () => { current = false; };
  }, [id]);

  async function approve() {
    if (!request || pending || request.approved) return;
    setError(undefined);
    setPending(true);
    try {
      await approveChatGptAction(id);
      setRequest({ ...request, approved: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'DUMA could not approve this action.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-headline">Approve a ChatGPT action</h1>
      {!id && <p role="alert">This request is missing. Return to ChatGPT and request a new approval.</p>}
      {id && !request && !error && <p role="status">Loading the requested action…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {request && (
        <>
          <p>Workspace <strong>{request.workspace}</strong></p>
          <p className="font-medium capitalize">{request.action}</p>
          {request.target && <p className="break-all text-sm text-muted-foreground">Target {request.target}</p>}
          {request.preview && (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{request.preview}</pre>
          )}
          {request.approved ? (
            <p role="status">Approved. Return to ChatGPT and ask it to continue with the same action.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Approve only if this is the action you requested. Close this page to leave it unapproved.</p>
              <Button type="button" disabled={pending} onClick={() => void approve()}>
                {pending ? 'Approving…' : 'Approve this action'}
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default function ChatGptApprovalPage() {
  return <Suspense fallback={<p role="status">Loading the requested action…</p>}><ActionApproval /></Suspense>;
}
