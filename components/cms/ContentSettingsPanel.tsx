'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { Database, Download, Gauge, Lock } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ChangeRow, Switch, ValueMissing } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { exportCmsContent, getCmsSettings, getCmsStorage, updateCmsSettings } from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { formatBytes } from '@/lib/utils/cms';
import { useCmsTenantId, useContentPaths } from '@/components/cms/ContentScope';

import { uploadTarget } from './StorageUsage';
import { RowWarning } from './rows';
import { cmsKeys, invalidateCms } from './shared';

/**
 * Content's own settings: file privacy, a full export, and where the files
 * live — which decides how far the privacy switch reaches. Keys and webhooks
 * moved to Settings → Developers, with every other public API. Laid out like
 * Settings → Account: a bento of short sections, each value a row, every
 * change saving at once.
 */
export function ContentSettingsPanel() {
  const reduceMotion = useReducedMotion();
  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
      className="grid items-start gap-5 xl:grid-cols-2"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <FilePrivacySection />
        <BackupSection />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <StorageSection />
      </div>
    </motion.div>
  );
}

/** A `ChangeRow`'s shape while its value loads. */
function RowBone() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <Bone className="size-10 shrink-0" />
      <span className="min-w-0 flex-1 space-y-1.5">
        <Bone className="h-2.5 w-20" />
        <Bone className="h-3.5 w-40 max-w-full" />
      </span>
    </div>
  );
}

// ─── File privacy ────────────────────────────────────────────────────────────

/**
 * Whether files only drafts use can be fetched by their URL. Off by default:
 * a file linked from outside the CMS (a logo in a site's code) would stop
 * loading. Applies to DUMA's file URLs; a file on a bucket's own public URL
 * is as public as that bucket. Saves on the switch — there is nothing else to edit.
 */
function FilePrivacySection() {
  const tenantId = useCmsTenantId();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: cmsKeys.settings(tenantId),
    queryFn: () => getCmsSettings(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const save = useMutation({
    mutationFn: (privateUnpublishedAssets: boolean) => updateCmsSettings({ privateUnpublishedAssets }, tenantId ?? undefined),
    onSuccess: (settings) => {
      invalidateCms(queryClient);
      toast('success', settings.privateUnpublishedAssets ? 'Draft-only files are now private.' : 'All files are reachable by URL again.');
    },
    onError: (error) => toast('error', error.message),
  });
  const on = query.data?.privateUnpublishedAssets ?? false;

  return (
    <RecordGroup
      card
      id="cms-file-privacy"
      title="File privacy"
      footnote="A file’s link stops working until a published entry uses it, so unreleased images can’t be found by guessing."
    >
      {query.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading file privacy">
          <RowBone />
        </div>
      ) : query.isError ? (
        <ErrorState title="Couldn’t load file privacy" onRetry={() => void query.refetch()} />
      ) : (
        <>
          <ChangeRow
            icon={Lock}
            label="Draft-only files"
            value={on ? 'Private' : <ValueMissing>Reachable by link</ValueMissing>}
            trailing={
              <Switch label="Keep draft-only files private" checked={on} disabled={save.isPending} onChange={(value) => save.mutate(value)} />
            }
          />
          {on && (
            <RowWarning className="mt-3">
              Files linked from outside the CMS — a logo in your site’s code — stop loading until an entry using them is published.
            </RowWarning>
          )}
        </>
      )}
    </RecordGroup>
  );
}

// ─── Backup ──────────────────────────────────────────────────────────────────

/** One JSON file with every model, language, entry and media record — a backup, or the start of a move. */
function BackupSection() {
  const tenantId = useCmsTenantId();
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const blob = await exportCmsContent(tenantId ?? undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `duma-content-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'The export failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <SettingsSection>
      <ChangeRow
        icon={Download}
        label="Export"
        value="All content as one JSON file"
        trailing={
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void download()} aria-label="Export all content">
            {busy ? 'Exporting…' : 'Download'}
          </Button>
        }
      />
    </SettingsSection>
  );
}

// ─── Where files live ────────────────────────────────────────────────────────

/** Where uploads go and how full it is — and whether a bucket's own public link sidesteps the privacy switch. */
function StorageSection() {
  const { storagePath } = useContentPaths();
  const tenantId = useCmsTenantId();
  const storage = useQuery({
    queryKey: cmsKeys.storage(tenantId),
    queryFn: () => getCmsStorage(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const target = uploadTarget(storage.data);
  const active = storage.data?.active;
  const connection = active?.kind === 'connection' ? storage.data?.connections.find((row) => row.id === active.connectionId) : undefined;

  return (
    <RecordGroup
      card
      id="cms-storage"
      title="Storage"
      footnote={
        connection?.configuration.publicBaseUrl
          ? `Files served from ${connection.displayName}’s own public link are as public as that bucket — the privacy switch covers DUMA’s file links only.`
          : undefined
      }
    >
      {storage.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading storage" className="space-y-5">
          <RowBone />
          <RowBone />
        </div>
      ) : storage.isError || !target ? (
        <ErrorState title="Couldn’t load storage" onRetry={() => void storage.refetch()} />
      ) : (
        <div>
          <ChangeRow
            icon={Database}
            label="Uploads go to"
            value={<span className="truncate">{target.name}</span>}
            trailing={
              <Button variant="outline" size="sm" asChild>
                <Link href={storagePath} aria-label="Manage storage">
                  Manage
                </Link>
              </Button>
            }
          />
          <ChangeRow
            icon={Gauge}
            label="Used"
            value={
              target.quotaBytes === null
                ? `${formatBytes(target.usedBytes)}, no limit`
                : `${formatBytes(target.usedBytes)} of ${formatBytes(target.quotaBytes)}`
            }
          />
        </div>
      )}
    </RecordGroup>
  );
}
