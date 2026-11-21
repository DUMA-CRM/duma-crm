'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { APP_PLACEMENTS, type AppSurface, getMarketplace, marketplaceKey } from '@/lib/api/marketplace.service';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';

const protocol = 'duma:connect:v1';
const outputTypes = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]);
const maxOutput = 10 * 1024 * 1024;
const maxSource = 24 * 1024 * 1024;

type Source = { url: string; name: string };
type Context = { total?: string; formattedTotal?: string; source?: Source };
type SaveImage = (file: File) => Promise<unknown>;

async function readSource(source: Source, signal: AbortSignal) {
  const url = new URL(source.url, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error('This source is unavailable.');
  const response = await fetch(url.href, { signal, redirect: 'error', cache: 'no-store' });
  const type = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!response.ok || !response.body || (!type.startsWith('image/') && !type.startsWith('video/'))
      || Number(response.headers.get('content-length')) > maxSource) {
    await response.body?.cancel();
    throw new Error('Use an image or video no larger than 24 MB.');
  }

  const reader = response.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSource) {
        await reader.cancel();
        throw new Error('Use an image or video no larger than 24 MB.');
      }
      parts.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new File(parts, source.name, { type });
}

function ExtensionFrame({
  workspaceId, slug, title, surface, revision, context, saveImage,
}: {
  workspaceId: string;
  slug: string;
  title: string;
  surface: AppSurface;
  revision: number;
  context: Context;
  saveImage?: SaveImage;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [connection, setConnection] = useState<MessagePort | null>(null);
  const [output, setOutput] = useState<File | null>(null);
  const preview = useRef<HTMLImageElement>(null);
  const [loadedImage, setLoadedImage] = useState<File>();
  const [status, setStatus] = useState('');
  const { total, formattedTotal, source } = context;
  const sourceUrl = source?.url;
  const sourceName = source?.name;
  const acceptsImage = Boolean(saveImage);
  const assertAvailable = useCallback(async () => {
    const store = await getMarketplace(workspaceId);
    const installation = store.apps.find((app) => app.slug === slug)?.installation;
    if (installation?.revision !== revision || !installation.activeSurfaces?.includes(surface)) {
      throw new Error('This app is no longer available. Reopen it to try again.');
    }
  }, [revision, slug, surface, workspaceId]);

  useEffect(() => {
    let connected: MessagePort | undefined;
    function onConnect(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin
          || event.data !== protocol || event.ports.length !== 1) return;
      connected?.close();
      connected = event.ports[0]!;
      setConnection(connected);
      setOutput(null);
      setStatus('');
    }
    window.addEventListener('message', onConnect);
    return () => {
      window.removeEventListener('message', onConnect);
      connected?.close();
    };
  }, []);

  useEffect(() => {
    if (!connection) return;
    const port = connection;
    const abort = new AbortController();
    let sourceRequested = false;
    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'request-source' && sourceUrl && sourceName && !sourceRequested) {
        sourceRequested = true;
        void assertAvailable().then(() => readSource({ url: sourceUrl, name: sourceName }, abort.signal)).then(
          (file) => {
            if (!abort.signal.aborted) port.postMessage({ type: 'source', file });
          },
          (error: unknown) => {
            if (!abort.signal.aborted) port.postMessage({
              type: 'source-error', message: error instanceof Error ? error.message : 'The source could not be loaded.',
            });
          },
        );
      }
      if (event.data?.type !== 'offer-image' || !acceptsImage) return;
      const image = event.data.image;
      const extension = image instanceof Blob ? outputTypes.get(image.type) : undefined;
      if (!extension || image.size === 0 || image.size > maxOutput) {
        setStatus('The app must return a PNG, JPEG, or WebP image under 10 MB.');
        return;
      }
      setStatus('');
      setOutput(new File([image], `${slug}-preview.${extension}`, { type: image.type }));
    }
    port.addEventListener('message', onMessage);
    port.start();
    port.postMessage({
      type: 'context', surface,
      ...(total === undefined ? {} : { order: { total, formattedTotal } }),
      ...(acceptsImage ? { hasSource: Boolean(sourceUrl) } : {}),
    });
    return () => {
      abort.abort();
      port.removeEventListener('message', onMessage);
    };
  }, [acceptsImage, assertAvailable, connection, formattedTotal, slug, sourceName, sourceUrl, surface, total]);

  useEffect(() => {
    if (!output || !preview.current) return;
    const url = URL.createObjectURL(output);
    preview.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [output]);

  const save = useMutation({
    mutationFn: async (file: File) => {
      await assertAvailable();
      if (!saveImage) throw new Error('Image saving is unavailable here.');
      await saveImage(file);
    },
    onSuccess: (_, file) => {
      setOutput((current) => current === file ? null : current);
      setStatus('Image saved.');
    },
  });

  const query = new URLSearchParams({ workspace: workspaceId, surface, revision: String(revision) });
  return (
    <div className="min-w-0 space-y-2">
      <iframe
        ref={frame}
        className="block h-96 w-full rounded-md border border-border bg-card"
        title={title}
        loading={surface === 'dashboard' ? 'lazy' : 'eager'}
        referrerPolicy="no-referrer"
        src={`/api/marketplace-frame/${encodeURIComponent(slug)}?${query}`}
      />
      {output && (
        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- Object URL for the user's approval. */}
          <img ref={preview} className="max-h-48 max-w-full rounded-md object-contain" alt={`Image generated by ${title}`}
            onLoad={() => setLoadedImage(output)} onError={() => {
              setLoadedImage(undefined);
              setStatus('The app returned an image DUMA could not display.');
            }} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={save.isPending || loadedImage !== output} onClick={() => save.mutate(output)}>
              {surface === 'menu.photo' ? 'Use this image' : 'Save as new media'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={save.isPending} onClick={() => {
              setOutput(null);
              save.reset();
            }}>Discard</Button>
          </div>
        </div>
      )}
      {status && <p role="status" className="text-sm">{status}</p>}
      {save.error && <p role="alert" className="text-sm text-exception">{save.error.message}</p>}
    </div>
  );
}

export function ExtensionSlot({
  surface, recordKey, total, formattedTotal, source, saveImage,
}: {
  surface: AppSurface;
  recordKey?: string;
  total?: string;
  formattedTotal?: string;
  source?: Source;
  saveImage?: SaveImage;
}) {
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;
  const store = useQuery({
    queryKey: marketplaceKey(workspaceId), queryFn: () => getMarketplace(workspaceId!),
    enabled: Boolean(workspaceId), refetchInterval: 30_000, staleTime: 15_000,
    meta: { silentError: true },
  });
  const [selected, setSelected] = useState<string>();
  if (!workspaceId || !store.data || store.isError) return null;
  const extensions = store.data.apps.flatMap(({ slug, installation }) => {
    if (!installation?.activeSurfaces?.includes(surface)) return [];
    const item = installation.release.extensions?.find((entry) => entry.surface === surface);
    return item ? [{ slug, revision: installation.revision, ...item }] : [];
  });
  if (extensions.length === 0) return null;

  return (
    <section aria-label={`${APP_PLACEMENTS[surface].label} apps`} className="space-y-2">
      {extensions.map(({ slug, revision, title, origin }) => {
        const key = JSON.stringify([workspaceId, slug, revision, recordKey, source?.url]);
        const inline = surface === 'dashboard';
        const open = inline || selected === key;
        return (
          <div key={key} className="space-y-2">
            {inline ? <h2 className="text-sm font-semibold">{title}</h2> : (
              <Button type="button" variant="outline" size="sm" aria-expanded={open}
                title={`${APP_PLACEMENTS[surface].access} · ${origin}`}
                onClick={() => setSelected(open ? undefined : key)}>
                {open ? `Close ${title}` : title}
              </Button>
            )}
            {open && (
              <>
                {!inline && <p className="break-all text-xs text-muted-foreground">{origin} · {APP_PLACEMENTS[surface].access}</p>}
                <ExtensionFrame workspaceId={workspaceId} slug={slug} title={title} surface={surface}
                  revision={revision} context={{ total, formattedTotal, source }} saveImage={saveImage} />
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
