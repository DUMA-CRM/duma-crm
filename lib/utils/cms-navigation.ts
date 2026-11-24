export type ContentTab = 'entries' | 'media' | 'configure';
export type ContentSection = 'models' | 'locales' | 'settings';

const tabs: readonly string[] = ['entries', 'media', 'configure'];
const sections: readonly string[] = ['models', 'locales', 'settings'];

/** Old tab links still open the same section, now under Configure; the retired Overview opens Entries. */
export function contentLocation(tab: string | null, section: string | null) {
  if (tab && sections.includes(tab)) return { tab: 'configure' as ContentTab, section: tab as ContentSection };
  const activeTab = tabs.includes(tab ?? '') ? (tab as ContentTab) : 'entries';
  return {
    tab: activeTab,
    section: activeTab === 'configure' && sections.includes(section ?? '') ? (section as ContentSection) : null,
  };
}

/** Editor actions may still refer to a section's original destination. */
export function contentNavigation(patch: Record<string, string | null>): Record<string, string | null> {
  if (patch.tab && sections.includes(patch.tab)) return { ...patch, tab: 'configure', section: patch.tab };
  if ('tab' in patch && patch.tab !== 'configure') return { ...patch, section: null };
  return patch;
}
