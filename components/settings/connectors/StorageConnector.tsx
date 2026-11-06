'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { useCmsTenantId, useContentPaths } from '@/components/cms/ContentScope';
import { StorageMeter } from '@/components/cms/StorageMeter';
import { invalidateCms } from '@/components/cms/shared';
import { Box, CheckCircle2, CloudUpload, Database, ExternalLink, Globe, KeyRound, Server } from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import { type CmsStorageConnection, createCmsStorageConnection } from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { QUOTA_UNITS, type QuotaUnit, parseBucketUrl, quotaToBytes } from '@/lib/utils/media-storage';

import { Command, ConnectWizard, ProviderGrid, WizardInstruction, WizardRail, type WizardStep } from './ConnectWizard';
import { type ConnectorBrand, PROVIDER_BRANDS } from './brands';
import { useStoredDraft } from './draft';
import { CONNECTORS_BY_ID } from './registry';
import { panelClass } from './shared';

const BRANDS: Partial<Record<Preset, ConnectorBrand>> = {
  r2: PROVIDER_BRANDS.cloudflare,
  aws: PROVIDER_BRANDS.s3,
  vercel: PROVIDER_BRANDS.vercel,
};

/** A provider link inside the field it helps fill, as on Telegram's token. */
const LINK_IN_FIELD =
  'inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8';

const DEFINITION = CONNECTORS_BY_ID['media-storage'];

type Preset = 'r2' | 'aws' | 'other' | 'vercel';

const PRESETS: { value: Preset; label: string; icon: typeof Database; hint: string; name: string }[] = [
  { value: 'r2', label: 'Cloudflare R2', icon: Globe, hint: 'Free to serve, 10 GB free', name: 'Cloudflare R2' },
  { value: 'aws', label: 'AWS S3', icon: Server, hint: 'A bucket in your AWS account', name: 'AWS S3' },
  { value: 'other', label: 'Another S3 service', icon: Box, hint: 'Backblaze, Spaces, Wasabi, MinIO', name: 'S3 storage' },
  {
    value: 'vercel',
    label: 'Vercel Blob',
    icon: CloudUpload,
    hint: 'On your website’s Vercel project',
    name: 'Vercel Blob',
  },
];

/** Where a connection's state comes from: the active bucket's last check. */
export { storageConnectorState } from '@/lib/utils/connector-state';

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
const EMPTY_FORM = {
  bucketUrl: '',
  endpoint: '',
  bucket: '',
  region: '',
  accessKeyId: '',
  displayName: '',
  publicBaseUrl: '',
  pathPrefix: '',
  quota: '',
  quotaUnit: 'GB' as QuotaUnit,
  activate: true,
};

export function StorageConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { basePath } = useContentPaths();
  const tenantId = useCmsTenantId() ?? undefined;
  const queryClient = useQueryClient();
  // The bucket details survive leaving the wizard; the secret key or token never does.
  const kept = useStoredDraft<{ preset: Preset | null; form: typeof EMPTY_FORM }>(tenantId ? `storage:${tenantId}` : null, {
    preset: null,
    form: EMPTY_FORM,
  });
  const [secret, setSecret] = useState('');
  const preset = kept.value.preset;
  const form = { ...kept.value.form, secret };
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<CmsStorageConnection | null>(null);
  const set = (patch: Partial<typeof form>) => {
    const { secret: nextSecret, ...rest } = patch;
    if (nextSecret !== undefined) setSecret(nextSecret);
    if (Object.keys(rest).length) kept.set({ ...kept.value, form: { ...kept.value.form, ...rest } });
  };
  const restart = () => {
    kept.clear();
    setSecret('');
  };

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
      restart();
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
      label: 'Provider',
      title: 'Where should your media live?',
      ready: preset !== null,
      content: (
        <ProviderGrid
          ariaLabel="Storage provider"
          options={PRESETS.map(({ value, label, icon, hint }) => ({ value, label, icon, hint, brand: BRANDS[value] }))}
          value={preset}
          onChange={(value) =>
            // One write: the pick and the name it fills in, so neither overwrites the other.
            kept.set({
              preset: value,
              form: { ...kept.value.form, displayName: PRESETS.find((item) => item.value === value)?.name ?? '' },
            })
          }
        />
      ),
    },
    ...(isS3
      ? [
          {
            key: 'location',
            label: 'Bucket',
            title: preset === 'r2' ? 'Paste the bucket’s S3 API URL' : 'Which bucket?',
            ready: locationReady,
            content: (
              <div className="space-y-3">
                <WizardInstruction icon={Database}>
                  {preset === 'r2'
                    ? 'In Cloudflare, open R2 → your bucket → Settings and copy the S3 API URL.'
                    : preset === 'aws'
                      ? 'Copy the bucket name and its region from the S3 console.'
                      : 'Use your provider’s S3 endpoint and the bucket name.'}
                </WizardInstruction>
                {preset === 'r2' ? (
                  <Input
                    label="S3 API URL"
                    autoFocus
                    placeholder="https://<account-id>.r2.cloudflarestorage.com/<bucket>"
                    value={form.bucketUrl}
                    onChange={(event) => set({ bucketUrl: event.target.value })}
                    className="pr-40"
                    rightAction={
                      <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" className={LINK_IN_FIELD}>
                        Open Cloudflare <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    }
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
                  <>
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
                        className={preset === 'aws' ? 'pr-28' : undefined}
                        rightAction={
                          preset === 'aws' ? (
                            <a href="https://console.aws.amazon.com/s3/" target="_blank" rel="noreferrer" className={LINK_IN_FIELD}>
                              Open S3 <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          ) : undefined
                        }
                      />
                      <Input
                        label={preset === 'aws' ? 'Region' : 'Region (optional)'}
                        placeholder={preset === 'aws' ? 'eu-west-2' : 'auto'}
                        value={form.region}
                        onChange={(event) => set({ region: event.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            ),
          } satisfies WizardStep,
        ]
      : []),
    {
      key: 'keys',
      label: 'Key',
      title: isS3 ? 'Add a key that can read and write' : 'Paste the store’s read-write token',
      ready: keysReady,
      content: (
        <div className="space-y-3">
          <WizardInstruction icon={KeyRound}>
            {preset === 'r2' ? (
              'In R2 → Manage API tokens, create a token with Object Read & Write on this bucket.'
            ) : isS3 ? (
              'Create an access key that can put, get and delete objects in this bucket, and nothing more.'
            ) : (
              <>
                In your Blob store’s settings, copy <Command>BLOB_READ_WRITE_TOKEN</Command>.
              </>
            )}
          </WizardInstruction>
          {isS3 ? (
            <>
              <Input
                label="Access key ID"
                autoFocus
                autoComplete="off"
                value={form.accessKeyId}
                onChange={(event) => set({ accessKeyId: event.target.value })}
                className={preset === 'aws' ? 'pr-32' : undefined}
                rightAction={
                  preset === 'aws' ? (
                    <a href="https://console.aws.amazon.com/iam/" target="_blank" rel="noreferrer" className={LINK_IN_FIELD}>
                      Open IAM <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : undefined
                }
              />
              <Input
                label="Secret access key"
                type="password"
                autoComplete="off"
                value={form.secret}
                onChange={(event) => set({ secret: event.target.value })}
              />
            </>
          ) : (
            <Input
              label="Read-write token"
              type="password"
              autoFocus
              autoComplete="off"
              placeholder="vercel_blob_rw_…"
              value={form.secret}
              onChange={(event) => set({ secret: event.target.value })}
              className="pr-32"
              rightAction={
                <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className={LINK_IN_FIELD}>
                  Open Vercel <ExternalLink size={12} aria-hidden="true" />
                </a>
              }
            />
          )}
        </div>
      ),
    },
    {
      key: 'options',
      label: 'Settings',
      title: 'How DUMA should use it',
      ready: optionsReady && !create.isPending,
      continueLabel: 'Connect and test',
      onContinue: connect,
      content: (
        <div className="space-y-6">
          {/* What it's called, and where your website finds the files. */}
          <div className="space-y-3">
            <Input label="Name" value={form.displayName} onChange={(event) => set({ displayName: event.target.value })} />
            {isS3 && (
              <Input
                label="Public URL (optional)"
                placeholder={preset === 'r2' ? 'https://pub-….r2.dev or https://media.yoursite.com' : 'https://cdn.yoursite.com'}
                value={form.publicBaseUrl}
                onChange={(event) => set({ publicBaseUrl: event.target.value })}
                hint="Files load straight from your CDN."
              />
            )}
          </div>
          {/* Optional limits. */}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
              <Input
                label="Storage limit (optional)"
                inputMode="decimal"
                placeholder="No limit"
                value={form.quota}
                onChange={(event) => set({ quota: event.target.value })}
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
              hint="If the bucket holds other files too."
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-rule/50 bg-field px-3 py-2.5">
            <span className="text-sm font-semibold text-foreground">Send new uploads here</span>
            <Switch label="Send new uploads here" checked={form.activate} onChange={(value) => set({ activate: value })} />
          </div>
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
      label: 'Done',
      title: 'Your storage is connected',
      description: connected?.isActive
        ? 'New uploads go here. Existing files stay where they are.'
        : 'Switch new uploads to it whenever you’re ready.',
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
            <Link href={`${basePath}?tab=media`} className="font-medium text-primary hover:underline">
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
      // Only the secret is lost on leaving; the rest is kept for next time.
      dirty={Boolean(secret) && !connected}
      steps={steps}
      // The connection exists from the confirmation screen on.
      lockedFrom={steps.length - 1}
      onClose={onClose}
      onFinish={onDone}
      resumeKey={tenantId ? `storage:${tenantId}` : null}
      onStartOver={restart}
      rail={<WizardRail requirements={DEFINITION.requirements} />}
    />
  );
}
