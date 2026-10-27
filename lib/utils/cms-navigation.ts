export type ContentTab = 'overview' | 'entries' | 'media' | 'configure' | 'updates';
export type ContentSection = 'models' | 'locales' | 'settings';

const tabs: readonly string[] = ['overview', 'entries', 'media', 'configure', 'updates'];
const sections: readonly string[] = ['models', 'locales', 'settings'];

/** Old tab links still open the same section, now under Configure. */
export function contentLocation(tab: string | null, section: string | null) {
  if (tab && sections.includes(tab)) return { tab: 'configure' as ContentTab, section: tab as ContentSection };
  const activeTab = tabs.includes(tab ?? '') ? (tab as ContentTab) : 'overview';
  return {
    tab: activeTab,
    section: activeTab === 'configure' && sections.includes(section ?? '') ? (section as ContentSection) : null,
  };
}

/** Overview cards and editor actions may still refer to their original destination. */
export function contentNavigation(patch: Record<string, string | null>): Record<string, string | null> {
  if (patch.tab && sections.includes(patch.tab)) return { ...patch, tab: 'configure', section: patch.tab };
  if ('tab' in patch && patch.tab !== 'configure') return { ...patch, section: null };
  return patch;
}
