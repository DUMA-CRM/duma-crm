'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { agreementReady, emptyAgreement, type Agreement } from '@/lib/marketplace/creator-agreement';
import { createAgreementLink, getAgreement, listAgreements, revokeAgreementLink, saveAgreement } from '@/lib/marketplace/creator-agreement-storage';

import { AgreementSnapshotView } from './AgreementSnapshotView';
import { CreatorAgreements } from './CreatorAgreements';

export function CreatorAgreementsWorkspace() {
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id ?? '';
  const query = useQueryClient();
  const key = ['creator-agreements', workspaceId] as const;
  const [offset, setOffset] = useState(0);
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState('');
  const [editor, setEditor] = useState({ key: 0, initial: emptyAgreement });
  const [link, setLink] = useState<{ id: string; url: string }>();
  const [copied, setCopied] = useState(false);
  const entries = useQuery({ queryKey: [...key, 'list', offset], queryFn: () => listAgreements(workspaceId, offset), enabled: Boolean(workspaceId && history) });
  const entry = useQuery({
    queryKey: [...key, selected], queryFn: () => getAgreement(workspaceId, selected), enabled: Boolean(workspaceId && selected && history),
  });
  const refresh = () => void query.invalidateQueries({ queryKey: key });
  const save = useMutation({
    mutationFn: (agreement: Agreement) => saveAgreement(workspaceId, agreement),
    onSuccess: (saved) => {
      refresh();
      setOffset(0);
      setSelected(saved.id);
      setHistory(true);
    },
  });
  const share = useMutation({
    mutationFn: (id: string) => createAgreementLink(workspaceId, id),
    onSuccess: ({ token }, id) => {
      setLink({ id, url: new URL(`/shared-agreement#${token}`, window.location.origin).href });
      setCopied(false);
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeAgreementLink(workspaceId, id),
    onSuccess: () => { setLink(undefined); refresh(); },
  });
  const saved = entry.data;
  const active = Boolean(saved?.expiresAt && new Date(saved.expiresAt).getTime() > entry.dataUpdatedAt);
  const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className="space-y-4">
      <nav aria-label="Creator Agreements" className="flex gap-2 border-b border-border pb-3">
        <Button variant={history ? 'ghost' : 'secondary'} aria-pressed={!history} onClick={() => setHistory(false)}>Editor</Button>
        <Button variant={history ? 'secondary' : 'ghost'} aria-pressed={history} onClick={() => setHistory(true)}>Saved contracts</Button>
      </nav>
      {save.error && <p role="alert" className="text-sm text-exception">{save.error.message}</p>}
      <div hidden={history}>
        <CreatorAgreements key={editor.key} initial={editor.initial} saving={save.isPending} onSave={(agreement) => save.mutate(agreement)} />
      </div>
      {history && (
        <div className="grid items-start gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
          <section className="min-w-0 rounded-lg border border-border bg-card p-3">
            <h2 className="mb-2 px-2 text-sm font-semibold">Saved contracts</h2>
            {entries.isPending ? <p className="p-2 text-sm text-muted-foreground">Loading contracts…</p>
              : entries.error ? <p role="alert" className="p-2 text-sm text-exception">{entries.error.message}</p>
              : entries.data.entries.length ? (
                <ul className="max-h-[32rem] space-y-1 overflow-auto">
                  {entries.data.entries.map((item) => (
                    <li key={item.id}><button type="button" aria-pressed={selected === item.id}
                      onClick={() => { setSelected(item.id); share.reset(); revoke.reset(); }}
                      className="block w-full min-w-0 rounded-md px-2 py-2 text-left text-sm hover:bg-band aria-pressed:bg-band">
                      <span className="block truncate font-medium">{item.campaign}</span>
                      <span className="text-xs text-muted-foreground">{date.format(new Date(item.createdAt))}</span>
                    </button></li>
                  ))}
                </ul>
              ) : <p className="p-2 text-sm text-muted-foreground">Save a copy from the editor to start your history.</p>}
            {entries.data && (offset > 0 || entries.data.hasMore) && (
              <div className="mt-2 flex justify-between gap-1 border-t border-border pt-2">
                <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(offset - 30)}>Previous</Button>
                <Button size="sm" variant="ghost" disabled={!entries.data.hasMore} onClick={() => setOffset(offset + 30)}>Next</Button>
              </div>
            )}
          </section>
          <div className="min-w-0 space-y-3">
            {selected && entry.isPending && <p role="status" className="text-sm text-muted-foreground">Loading contract…</p>}
            {entry.error && <p role="alert" className="text-sm text-exception">{entry.error.message}</p>}
            {saved && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditor((current) => ({ key: current.key + 1, initial: saved.agreement }));
                    setHistory(false);
                  }}>Edit a copy</Button>
                  {agreementReady(saved.agreement) && <Button size="sm" disabled={share.isPending || revoke.isPending}
                    onClick={() => share.mutate(saved.id)}>{active ? 'Replace link' : 'Create view link'}</Button>}
                  {active && <Button size="sm" variant="outline" disabled={share.isPending || revoke.isPending}
                    onClick={() => revoke.mutate(saved.id)}>Revoke link</Button>}
                </div>
                {active && <p className="text-xs text-muted-foreground">Anyone with the link can view this copy until {date.format(new Date(saved.expiresAt!))}.</p>}
                {link?.id === saved.id && active && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm" aria-label="Private contract link"
                      readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} />
                    <Button size="sm" variant="outline" onClick={() => {
                      void navigator.clipboard?.writeText(link.url).then(() => setCopied(true)).catch(() => setCopied(false));
                    }}>{copied ? 'Copied' : 'Copy link'}</Button>
                  </div>
                )}
                {(share.error || revoke.error) && <p role="alert" className="text-sm text-exception">{(share.error ?? revoke.error)?.message}</p>}
                <AgreementSnapshotView document={saved.document} language={saved.agreement.language} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
