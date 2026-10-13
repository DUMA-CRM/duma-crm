'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { Loader2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';

import { exportCmsContent, getCmsSettings, updateCmsSettings } from '@/lib/modules/cms/client';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { cmsKeys, invalidateCms } from './shared';

const rowClass = 'flex flex-wrap items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3';

/**
 * Content's own settings: file privacy and a full export. Keys and webhooks
 * moved to Settings → Developers, with every other public API.
 */
export function ContentSettingsPanel() {
  return (
    <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      <SettingsTabBody>
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
 * is as public as that bucket.
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
  return (
    <SettingsSection title="File privacy">
      {query.isError ? (
        <ErrorState title="Couldn’t load file privacy" onRetry={() => void query.refetch()} />
      ) : (
        <div className={rowClass}>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Keep draft-only files private</span>
            <span className="block text-xs text-muted-foreground">
              A file’s URL stops working until a published entry uses it, so unreleased images can’t be found by guessing. Files linked from
              outside the CMS stop loading too. Files on a connected bucket’s own public URL follow that bucket’s rules.
            </span>
          </span>
          <Switch
            label="Keep draft-only files private"
            checked={query.data?.privateUnpublishedAssets ?? false}
            disabled={!query.data || save.isPending}
            onChange={(value) => save.mutate(value)}
          />
        </div>
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
      <div className={rowClass}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Export all content</span>
          <span className="block text-xs text-muted-foreground">
            Every model, language and entry (drafts and live), and each media file’s details and URL, as one JSON file. Files themselves
            stay where they are.
          </span>
        </span>
        <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => void download()}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null} {busy ? 'Exporting…' : 'Export JSON'}
        </Button>
      </div>
    </SettingsSection>
  );
}
