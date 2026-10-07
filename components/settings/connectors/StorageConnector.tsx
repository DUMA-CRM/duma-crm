'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { StorageMeter } from '@/components/cms/StorageMeter';
import { invalidateCms } from '@/components/cms/shared';
import { Box, CheckCircle2, CloudUpload, Database, Globe, Server } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import { type CmsStorage, type CmsStorageConnection, createCmsStorageConnection } from '@/lib/modules/cms/client';
import { formatBytes } from '@/lib/utils/cms';
import { QUOTA_UNITS, type QuotaUnit, parseBucketUrl, quotaToBytes } from '@/lib/utils/media-storage';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, ProviderGrid, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID, type ConnectorState } from './registry';
import { panelClass } from './shared';

const DEFINITION = CONNECTORS_BY_ID['media-storage'];

type Preset = 'r2' | 'aws' | 'other' | 'vercel';

const PRESETS: { value: Preset; label: string; icon: typeof Database; hint: string; name: string }[] = [
  { value: 'r2', label: 'Cloudflare R2', icon: Globe, hint: 'No fees for serving files, 10 GB free.', name: 'Cloudflare R2' },
  { value: 'aws', label: 'AWS S3', icon: Server, hint: 'An S3 bucket in your AWS account.', name: 'AWS S3' },
  { value: 'other', label: 'Another S3 service', icon: Box, hint: 'Backblaze B2, DigitalOcean Spaces, Wasabi, MinIO.', name: 'S3 storage' },
  {
    value: 'vercel',
    label: 'Vercel Blob',
    icon: CloudUpload,
    hint: 'A Blob store on the Vercel project your website runs on.',
    name: 'Vercel Blob',
  },
];

/** Where a connection's state comes from: the active bucket's last check. */
export function storageConnectorState(storage: CmsStorage | undefined): ConnectorState {
  const active = storage?.connections.find((connection) => connection.isActive);
  if (!active) return 'disconnected';
  return active.lastError ? 'attention' : 'connected';
}

/** "Cloudflare R2 · duma", for the card and the manage page. */
export function storageProviderLabel(connection: CmsStorageConnection): string {
  if (connection.provider === 'vercel_blob') return 'Vercel Blob';
  const { endpoint, region, bucket } = connection.configuration;
  const host = endpoint?.includes('.r2.cloudflarestorage.com')
    ? 'Cloudflare R2'
    : endpoint
      ? new URL(endpoint).hostname
      : `AWS S3${region ? ` · ${region}` : ''}`;
  return [host, bucket].filter(Boolean).join(' · ');
}

/**
 * Connect a bucket, onboarding-style: provider → where it is → the key → how
 * it is used → done. The API writes and deletes a test file before saving, so
 * a mistyped or read-only key fails on the "Connect and test" step with the
 * provider's own reason, and nothing half-configured is ever saved.
 */
export function StorageConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset | null>(null);
  const [form, setForm] = useState({
    bucketUrl: '',
    endpoint: '',
    bucket: '',
    region: '',
    accessKeyId: '',
    secret: '',
    displayName: '',
    publicBaseUrl: '',
    pathPrefix: '',
    quota: '',
    quotaUnit: 'GB' as QuotaUnit,
    activate: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<CmsStorageConnection | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const chosen = PRESETS.find((item) => item.value === preset);
  const parsed = preset === 'r2' ? parseBucketUrl(form.bucketUrl) : null;
  const quotaBytes = quotaToBytes(form.quota, form.quotaUnit);
  const isS3 = preset !== null && preset !== 'vercel';

  const locationReady =
    preset === 'r2'
      ? Boolean(parsed?.bucket)
      : preset === 'aws'
        ? Boolean(form.bucket.trim() && form.region.trim())
        : preset === 'other'
          ? Boolean(form.endpoint.trim() && form.bucket.trim())
          : true;
  const keysReady = isS3 ? Boolean(form.accessKeyId.trim() && form.secret.trim()) : Boolean(form.secret.trim());
  const optionsReady = quotaBytes !== undefined;

  const create = useMutation({
    mutationFn: () =>
      createCmsStorageConnection(
        {
          provider: preset === 'vercel' ? 'vercel_blob' : 's3',
          displayName: form.displayName.trim() || chosen?.name || 'Storage',
          configuration:
            preset === 'vercel'
              ? { pathPrefix: form.pathPrefix }
              : {
                  accessKeyId: form.accessKeyId,
                  publicBaseUrl: form.publicBaseUrl,
                  pathPrefix: form.pathPrefix,
                  ...(preset === 'r2'
                    ? { endpoint: parsed?.endpoint ?? '', bucket: parsed?.bucket ?? '', region: 'auto' }
                    : preset === 'aws'
                      ? { bucket: form.bucket, region: form.region }
                      : { endpoint: form.endpoint, bucket: form.bucket, region: form.region }),
                },
          secret: form.secret.trim(),
          quotaBytes: quotaBytes ?? null,
          activate: form.activate,
        },
        tenantId,
      ),
    onSuccess: (connection) => {
      invalidateCms(queryClient);
      setConnected(connection);
    },
  });

  async function connect(): Promise<boolean> {
    setError(null);
    try {
      await create.mutateAsync();
      return true;
    } catch (failure) {
      // A provider refusal (422) is about the details entered — say it on the step.
      const message = failure instanceof Error ? failure.message : 'The storage could not be connected.';
      setError(message);
      if (!(failure instanceof ApiError && (failure.status === 422 || failure.status === 400))) toast('error', message);
      return false;
    }
  }

  const steps: WizardStep[] = [
    {
      key: 'provider',
      title: 'Where should your media live?',
      description: 'Pick the service your bucket is on. Nothing is saved until the last step checks it works.',
      ready: preset !== null,
      content: (
        <ProviderGrid
          ariaLabel="Storage provider"
          options={PRESETS.map(({ value, label, icon, hint }) => ({ value, label, icon, hint }))}
          value={preset}
          onChange={(value) => {
            setPreset(value);
            set({ displayName: PRESETS.find((item) => item.value === value)?.name ?? '' });
          }}
        />
      ),
    },
    ...(isS3
      ? [
          {
            key: 'location',
            title: preset === 'r2' ? 'Paste the bucket’s S3 API URL' : 'Which bucket?',
            description:
              preset === 'r2'
                ? 'In Cloudflare: R2 → your bucket → Settings. Copy the S3 API URL — it ends with the bucket name.'
                : preset === 'aws'
                  ? 'The bucket name and the region it was created in, both shown in the S3 console.'
                  : 'Your provider’s S3 endpoint and the bucket name. The region is optional for most services.',
            ready: locationReady,
            content:
              preset === 'r2' ? (
                <Input
                  label="S3 API URL"
                  autoFocus
                  placeholder="https://<account-id>.r2.cloudflarestorage.com/<bucket>"
                  value={form.bucketUrl}
                  onChange={(event) => set({ bucketUrl: event.target.value })}
                  hint={parsed?.bucket ? `Bucket “${parsed.bucket}” on ${new URL(parsed.endpoint).hostname}` : undefined}
                  error={
                    form.bucketUrl && !parsed
                      ? 'Paste the full https:// URL'
                      : form.bucketUrl && parsed && !parsed.bucket
                        ? 'Add the bucket name after the last /'
                        : undefined
                  }
                />
              ) : (
                <div className="space-y-4">
                  {preset === 'other' && (
                    <Input
                      label="Endpoint"
                      autoFocus
                      placeholder="https://s3.eu-central-003.backblazeb2.com"
                      value={form.endpoint}
                      onChange={(event) => set({ endpoint: event.target.value })}
                    />
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Bucket"
                      autoFocus={preset === 'aws'}
                      value={form.bucket}
                      onChange={(event) => set({ bucket: event.target.value })}
                    />
                    <Input
                      label={preset === 'aws' ? 'Region' : 'Region (optional)'}
                      placeholder={preset === 'aws' ? 'eu-west-2' : 'auto'}
                      value={form.region}
                      onChange={(event) => set({ region: event.target.value })}
                    />
                  </div>
                </div>
              ),
          } satisfies WizardStep,
        ]
      : []),
    {
      key: 'keys',
      title: isS3 ? 'Add a key that can read and write' : 'Paste the store’s read-write token',
      description: isS3
        ? preset === 'r2'
          ? 'In Cloudflare: R2 → Manage API tokens → Create token, with Object Read & Write on this bucket.'
          : 'An access key with permission to put, get and delete objects in this bucket — nothing more.'
        : 'In Vercel: Storage → your Blob store → .env.local. Copy the value of BLOB_READ_WRITE_TOKEN.',
      ready: keysReady,
      content: isS3 ? (
        <div className="space-y-4">
          <Input
            label="Access key ID"
            autoFocus
            autoComplete="off"
            value={form.accessKeyId}
            onChange={(event) => set({ accessKeyId: event.target.value })}
          />
          <Input
            label="Secret access key"
            type="password"
            autoComplete="off"
            value={form.secret}
            onChange={(event) => set({ secret: event.target.value })}
            hint="Encrypted when saved and never shown again."
          />
        </div>
      ) : (
        <Input
          label="Read-write token"
          type="password"
          autoFocus
          autoComplete="off"
          placeholder="vercel_blob_rw_…"
          value={form.secret}
          onChange={(event) => set({ secret: event.target.value })}
          hint="Encrypted when saved and never shown again."
        />
      ),
    },
    {
      key: 'options',
      title: 'How DUMA should use it',
      description:
        'Providers don’t report how much space you have, so set your plan’s size or a budget to see what’s free. DUMA uploads a test file and deletes it when you continue.',
      ready: optionsReady && !create.isPending,
      continueLabel: 'Connect and test',
      onContinue: connect,
      content: (
        <div className="space-y-4">
          <Input label="Name" value={form.displayName} onChange={(event) => set({ displayName: event.target.value })} />
          {isS3 && (
            <Input
              label="Public URL (optional)"
              placeholder={preset === 'r2' ? 'https://pub-….r2.dev or https://media.yoursite.com' : 'https://cdn.yoursite.com'}
              value={form.publicBaseUrl}
              onChange={(event) => set({ publicBaseUrl: event.target.value })}
              hint="With it, your website loads files straight from your CDN. Without it, DUMA serves them."
            />
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
            <Input
              label="Storage limit (optional)"
              inputMode="decimal"
              placeholder="No limit"
              value={form.quota}
              onChange={(event) => set({ quota: event.target.value })}
              hint="Uploads stop at the limit."
              error={quotaBytes === undefined ? 'Enter a positive number, or leave it blank' : undefined}
            />
            <div className="sm:pt-5">
              <Select
                ariaLabel="Limit unit"
                className="w-full"
                value={form.quotaUnit}
                onValueChange={(value) => set({ quotaUnit: value as QuotaUnit })}
                options={QUOTA_UNITS.map((unit) => ({ value: unit, label: unit }))}
              />
            </div>
          </div>
          <Input
            label="Folder prefix (optional)"
            placeholder="cms"
            value={form.pathPrefix}
            onChange={(event) => set({ pathPrefix: event.target.value })}
            hint="Keeps DUMA’s files in one folder when the bucket holds other things too."
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.activate}
              onChange={(event) => set({ activate: event.target.checked })}
              className="size-4 shrink-0 rounded accent-primary"
            />
            Send new uploads here straight away
          </label>
          {error && (
            <p role="alert" className="rounded-md border border-exception/50 bg-exception/6 px-3 py-2 text-sm text-exception">
              {error}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'done',
      title: 'Your storage is connected',
      description: connected?.isActive
        ? 'New uploads in Content go here from now on. Files already uploaded stay where they are, so no link breaks.'
        : 'It’s ready whenever you switch new uploads to it.',
      continueLabel: 'Done',
      content: (
        <div className={`${panelClass} space-y-4`}>
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{connected?.displayName} passed the test upload</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{connected ? storageProviderLabel(connected) : ''}</p>
            </div>
          </div>
          {connected && <StorageMeter byKind={connected.byKind} quotaBytes={connected.quotaBytes} />}
          <p className="text-xs text-muted-foreground">
            Upload and optimise images in{' '}
            <Link href="/content?tab=media" className="font-medium text-primary hover:underline">
              Content → Media
            </Link>
            .
          </p>
        </div>
      ),
    },
  ];

  return (
    <ConnectWizard
      eyebrow="Connect"
      title="Media storage"
      icon={<Database size={20} aria-hidden="true" />}
      dirty={preset !== null && !connected}
      steps={steps}
      // The connection exists from the confirmation screen on.
      lockedFrom={steps.length - 1}
      onClose={onClose}
      onFinish={onDone}
      rail={
        <WizardRail
          icon={Database}
          name={DEFINITION.name}
          tagline={DEFINITION.tagline}
          requirements={DEFINITION.requirements}
          footnote={<>Until you connect one, media is kept in DUMA storage — free up to {formatBytes(50 * 1024 * 1024)} per workspace.</>}
        />
      }
    />
  );
}
