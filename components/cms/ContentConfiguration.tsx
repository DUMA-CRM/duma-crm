import { Languages, Layers, SlidersHorizontal } from '@/components/icons';
import { SettingsDestination } from '@/components/settings/configuration/SettingsDestination';

/** Content configuration uses the same destination tiles as workspace settings. */
export function ContentConfiguration({ canManageKeys }: { canManageKeys: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Content configuration">
      <SettingsDestination href="/content?tab=configure&section=models" title="Models" description="" icon={Layers} titleOnly />
      <SettingsDestination href="/content?tab=configure&section=locales" title="Locales" description="" icon={Languages} titleOnly />
      {canManageKeys && (
        <SettingsDestination
          href="/content?tab=configure&section=settings"
          title="Privacy & export"
          description=""
          icon={SlidersHorizontal}
          titleOnly
        />
      )}
    </div>
  );
}
