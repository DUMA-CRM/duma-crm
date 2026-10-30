import { Layers, Plug, UserRound } from '@/components/icons';
import { SettingsDestination } from '@/components/settings/configuration/SettingsDestination';
import { EditorShell } from '@/components/shared/EditorShell';

export default function AdminSettingsPage() {
  return (
    <EditorShell title="Settings">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Connections and configuration for DUMA’s internal workspace.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsDestination
            href="/admin/settings/connectors"
            title="Connections"
            description="Media storage, email, Telegram and web analytics."
            icon={Plug}
          />
          <SettingsDestination
            href="/admin/content?tab=configure"
            title="Content configuration"
            description="Blog models, languages, privacy and export."
            icon={Layers}
          />
        </div>
        <SettingsDestination
          href="/settings/account"
          title="Your account"
          description="Your personal profile, appearance and sign-in settings."
          icon={UserRound}
        />
      </div>
    </EditorShell>
  );
}
