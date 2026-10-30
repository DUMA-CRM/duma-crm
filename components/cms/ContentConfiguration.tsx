'use client';

import { Languages, Layers, SlidersHorizontal } from '@/components/icons';
import { SettingsDestination } from '@/components/settings/configuration/SettingsDestination';

import { useContentPaths } from './ContentScope';

/** Content configuration uses the same destination tiles as workspace settings. */
export function ContentConfiguration({ canManageKeys }: { canManageKeys: boolean }) {
  const { basePath } = useContentPaths();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Content configuration">
      <SettingsDestination href={`${basePath}?tab=configure&section=models`} title="Models" description="" icon={Layers} titleOnly />
      <SettingsDestination href={`${basePath}?tab=configure&section=locales`} title="Locales" description="" icon={Languages} titleOnly />
      {canManageKeys && (
        <SettingsDestination
          href={`${basePath}?tab=configure&section=settings`}
          title="Privacy & export"
          description=""
          icon={SlidersHorizontal}
          titleOnly
        />
      )}
    </div>
  );
}
