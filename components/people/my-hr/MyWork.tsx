'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { Boxes, CalendarClock, CalendarRange } from '@/components/icons';
import { MyRota } from '@/components/scheduling/MyRota';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';

import { useWorkspaceModules } from '@/lib/hooks/useWorkspaceContext';

import { MY_HR_TAB_DEFS, MyHrWorkspace } from './MyHrWorkspace';
import { MY_HR_TABS, MY_WORK_TAB_ALIASES, type MyHrTab, type MyWorkTab } from './shared';

const ROTA_TAB: SectionTab<MyWorkTab> = { value: 'rota', label: 'Rota', icon: CalendarRange };
const TITLE = 'My work';
const ICON = <CalendarClock size={20} aria-hidden="true" />;

/**
 * My work — your own rota and your own HR, one page (was My rota /scheduling
 * and My HR /my-hr). Like those two, it has no capability guard: every
 * signed-in member reaches their own record, and every call is a `/me` or
 * `/my` endpoint. Rota shows when the workforce module is on, the HR tabs when
 * the people module is. The open tab is `?tab=`, so links, back and refresh
 * keep it; with none it opens on Rota when there is one, otherwise Overview.
 */
export function MyWork() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modules = useWorkspaceModules();
  const on = (id: string) => modules?.some((state) => state.moduleId === id && state.status === 'enabled') ?? false;
  const rotaOn = on('workforce');
  const hrOn = on('people');

  const setTab = useCallback(
    (next: MyWorkTab) => router.replace(`${pathname}?tab=${next}`, { scroll: false }),
    [pathname, router],
  );
  const leadingTabs = useMemo(() => (rotaOn ? [ROTA_TAB] : []), [rotaOn]);

  // The context has loaded before the content renders; this is only a guard.
  if (!modules) return null;

  if (!rotaOn && !hrOn) {
    return (
      <EditorShell title={TITLE} icon={ICON}>
        <EmptyState
          icon={Boxes}
          kind="gone"
          title="My work is off in this workspace"
          description="Your rota and HR records appear here when scheduling or people management is switched on."
          action={{ label: 'Open module settings', href: '/settings/modules' }}
        />
      </EditorShell>
    );
  }

  const raw = searchParams.get('tab') ?? '';
  const requested = (MY_WORK_TAB_ALIASES[raw] ?? raw) as MyWorkTab;
  const available = (value: MyWorkTab) => (value === 'rota' ? rotaOn : hrOn && MY_HR_TABS.includes(value));
  // A deep link to edit your details has no tab of its own; it belongs to Overview.
  const fallback: MyWorkTab = rotaOn && !(hrOn && searchParams.get('action') === 'edit-details') ? 'rota' : 'overview';
  const tab: MyWorkTab = available(requested) ? requested : fallback;

  if (tab === 'rota') {
    const tabs = [ROTA_TAB, ...(hrOn ? (MY_HR_TAB_DEFS as SectionTab<MyWorkTab>[]) : [])];
    return (
      <MyRota
        title={TITLE}
        icon={ICON}
        subheader={
          tabs.length > 1 ? (
            <SectionTabs<MyWorkTab> tabs={tabs} value={tab} onChange={setTab} ariaLabel="My work sections" animationId="my-work-tabs" />
          ) : undefined
        }
      />
    );
  }
  return <MyHrWorkspace tab={tab as MyHrTab} onTabChange={setTab} leadingTabs={leadingTabs} />;
}
