'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { AlertTriangle, ChevronRight, Database, Download, FileText, Lock, Settings } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import { exportCmsContent, getCmsSettings, getCmsStorage, updateCmsSettings } from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { formatBytes } from '@/lib/utils/cms';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { uploadTarget } from './StorageUsage';
import { ActionRow, ActionRows, InfoRow, InfoRows, RowTile } from './rows';
import { cmsKeys, invalidateCms } from './shared';

/**
 * Content's own settings: file privacy and a full export. Keys and webhooks
 * moved to Settings → Developers, with every other public API. Laid out like
 * the settings rules tabs: the two settings in the main column, where the
 * files actually live alongside — that decides how far the privacy switch reaches.
 */
export function ContentSettingsPanel() {
  const reduceMotion = useReducedMotion();
  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      <SettingsTabBody narrowAside aside={<StorageSection />}>
        <FilePrivacySection />
        <BackupSection />
      </SettingsTabBody>
    </motion.div>
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
  const tenantId = useWorkspaceStore((state) => state.tenantId);
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
    <SettingsSection
      title="File privacy"
      actions={query.data ? <Badge variant={on ? 'success' : 'muted'}>{on ? 'Private' : 'Off'}</Badge> : undefined}
    >
      {query.isPending ? (
        <Bone className="h-8 w-full rounded-md" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load file privacy" onRetry={() => void query.refetch()} />
      ) : (
        <>
          <InfoRow icon={Lock} title="Keep draft-only files private">
            <Switch label="Keep draft-only files private" checked={on} disabled={save.isPending} onChange={(value) => save.mutate(value)} />
          </InfoRow>
          <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
            A file’s link stops working until a published entry uses it, so unreleased images can’t be found by guessing.
          </p>
          {on && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
              <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
              <span>
                Files linked from outside the CMS — a logo in your site’s code — stop loading until an entry using them is published.
              </span>
            </p>
          )}
        </>
      )}
    </SettingsSection>
  );
}

// ─── Backup ──────────────────────────────────────────────────────────────────

/** One JSON file with every model, language, entry and media record — a backup, or the start of a move. */
function BackupSection() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
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
    <SettingsSection title="Backup">
      <ActionRows>
        <ActionRow
          icon={busy ? FileText : Download}
          label={busy ? 'Exporting…' : 'Export all content'}
          disabled={busy}
          onClick={() => void download()}
        />
      </ActionRows>
      <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
        One JSON file: every model, language and entry (drafts and live), and each media file’s details and link. The files themselves stay
        where they are.
      </p>
    </SettingsSection>
  );
}

// ─── Where files live ────────────────────────────────────────────────────────

/** Where uploads go and how full it is — and whether a bucket's own public link sidesteps the privacy switch. */
function StorageSection() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const storage = useQuery({
    queryKey: cmsKeys.storage(tenantId),
    queryFn: () => getCmsStorage(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const target = uploadTarget(storage.data);
  const active = storage.data?.active;
  const connection = active?.kind === 'connection' ? storage.data?.connections.find((row) => row.id === active.connectionId) : undefined;

  return (
    <SettingsSection title="Where files live">
      {storage.isPending ? (
        <Bone className="h-20 w-full rounded-md" />
      ) : storage.isError || !target ? (
        <ErrorState title="Couldn’t load storage" onRetry={() => void storage.refetch()} />
      ) : (
        <>
          <InfoRows>
            <InfoRow icon={Database} title="Uploads go to">
              <span className="truncate text-sm font-semibold text-foreground">{target.name}</span>
            </InfoRow>
            <InfoRow icon={FileText} title="Used">
              <span className="text-sm font-semibold text-foreground">
                {target.quotaBytes === null
                  ? `${formatBytes(target.usedBytes)}, no limit`
                  : `${formatBytes(target.usedBytes)} of ${formatBytes(target.quotaBytes)}`}
              </span>
            </InfoRow>
          </InfoRows>
          {connection?.configuration.publicBaseUrl && (
            <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              Files served from {connection.displayName}’s own public link are as public as that bucket — the privacy switch covers DUMA’s
              file links only.
            </p>
          )}
          <div className="-mx-2 mt-4 flex flex-col gap-0.5">
            <Link
              href="/settings/connectors?connector=media-storage"
              className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50"
            >
              <RowTile icon={Settings} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">Manage storage</span>
                <span className="block truncate text-xs text-muted-foreground">Settings → Connections → Media storage</span>
              </span>
              <ChevronRight
                size={14}
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </>
      )}
    </SettingsSection>
  );
}
