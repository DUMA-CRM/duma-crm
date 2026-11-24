'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { consentToChatGpt, getChatGptWorkspace, type ChatGptWorkspace } from '@/lib/api/auth.service';
import { chatgptOAuthDestination, chatgptOAuthQuery } from '@/lib/utils/chatgpt-connection';

const permissions = {
  'catalog:read': 'Read products for sale, categories, prices and availability.',
  'content:read': 'Read published website content and its public fields.',
};

function ChatGptConsent() {
  const query = chatgptOAuthQuery(useSearchParams().toString());
  const manage = new URLSearchParams(query).get('scope')?.split(' ').includes('duma:manage') ?? false;
  const [workspace, setWorkspace] = useState<ChatGptWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!query) return;
    let active = true;
    void getChatGptWorkspace(manage).then(
      (result) => { if (active) setWorkspace(result); },
      (failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Could not load your DUMA workspace.');
      },
    );
    return () => { active = false; };
  }, [query, manage]);

  async function submit(accept: boolean) {
    if (!query || pending || (accept && !workspace)) return;
    setPending(true);
    setError(null);
    try {
      const result = await consentToChatGpt(query, accept, workspace?.tenantId);
      const destination = result.redirect && chatgptOAuthDestination(result.url, window.location.origin);
      if (!destination) throw new Error('Start the DUMA connection again in ChatGPT.');
      window.location.replace(destination);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not complete the connection.');
      setPending(false);
    }
  }

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-headline">Connect ChatGPT to DUMA</h1>
      {!query && <p role="alert">This connection request is missing or expired. Start again in ChatGPT.</p>}
      {query && !workspace && !error && <p role="status">Loading your workspace…</p>}
      {workspace && (
        <>
          <p>Allow ChatGPT {workspace.manage ? "to manage" : "read access to"} <strong>{workspace.name}</strong>?</p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {(Object.keys(permissions) as Array<keyof typeof permissions>).map((scope) => (
              <li key={scope}>
                {permissions[scope]} {!workspace.scopes.includes(scope) && 'Currently unavailable in this workspace.'}
              </li>
            ))}
          </ul>
          {workspace.manage && (
            <p className="text-sm text-muted-foreground">
              Management access can read private workspace data, create and edit records, publish content, and delete items within
              your DUMA permissions. DUMA asks you to approve destructive changes before they run.
            </p>
          )}
          <p className="text-sm text-muted-foreground">DUMA checks your current workspace permissions on every action.</p>
          <p className="text-sm text-muted-foreground">You can disconnect DUMA in ChatGPT’s plugin settings.</p>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {query && (
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" disabled={pending} onClick={() => void submit(false)}>Cancel</Button>
          <Button type="button" disabled={!workspace || pending} onClick={() => void submit(true)}>
            {pending ? 'Please wait…' : 'Allow access'}
          </Button>
        </div>
      )}
    </section>
  );
}

export default function ChatGptConsentPage() {
  return <Suspense fallback={<p role="status">Loading your workspace…</p>}><ChatGptConsent /></Suspense>;
}
