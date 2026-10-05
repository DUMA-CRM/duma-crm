'use client';

import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  Mail,
  MapPin,
  Monitor,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from '@/components/icons';
import { ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { AgentModelSettings } from '@/components/settings/AgentModelSettings';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Fact, SettingRow, SettingRows } from '@/components/settings/controls';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { useAuthStore } from '@/stores/authStore';
import { usePwaStore } from '@/stores/pwaStore';

type Theme = 'light' | 'dark' | 'system';

const THEMES = [
  { value: 'light', label: 'Light', detail: 'Warm, bright surfaces for daytime.', icon: Sun },
  { value: 'dark', label: 'Dark', detail: 'Easier on the eyes in low light.', icon: Moon },
  { value: 'system', label: 'System', detail: 'Follows this device’s setting.', icon: Monitor },
] as const;


const humanise = (role: string) => role.charAt(0).toUpperCase() + role.slice(1).replaceAll('_', ' ');

const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true);
}

export function ProfileTab() {
  const mounted = useMounted();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const { tenant, location } = useCurrentWorkspace();
  const { theme, setTheme } = useTheme();
  const [firstName = '', lastName = ''] = (user?.name ?? '').split(' ');

  return (
    <SettingsTabBody
      aside={
        <>
          <SettingsSection title="This device">
            <SettingRows>
                <SettingRow icon={SlidersHorizontal} title="Till and kitchen screen" description="Layout, favourites, scanner and the order chime.">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/settings/configuration">Configuration</Link>
                  </Button>
                </SettingRow>
                <InstallRow />
              </SettingRows>
          </SettingsSection>
          <AgentModelSettings />
        </>
      }
    >
      <SettingsSection>
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <InitialsAvatar
            firstName={firstName || 'U'}
            lastName={lastName}
            email={user?.email}
            className="size-24 shrink-0 rounded-xl text-3xl shadow-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-2xl font-semibold tracking-headline text-foreground">{user?.name ?? 'Your account'}</p>
            <p className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
              <Mail size={15} aria-hidden="true" />
              <span className="truncate">{user?.email}</span>
              {user && <Badge variant={user.emailVerified ? 'success' : 'muted'}>{user.emailVerified ? 'Verified' : 'Not verified'}</Badge>}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <Fact icon={ShieldCheck} label="Role" value={role ? humanise(role) : '—'} />
          <Fact icon={Building2} label="Workspace" value={tenant?.name ?? '—'} />
          <Fact icon={MapPin} label="Location" value={location?.name ?? 'None selected'} />
          <Fact
            icon={CalendarDays}
            label="Member since"
            value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '—'}
          />
        </dl>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <ChoiceGrid<Theme>
          label="Colour theme"
          shortcuts={false}
          columns={3}
          selected={mounted && theme ? [theme as Theme] : []}
          onChange={setTheme}
          choices={THEMES}
        />
      </SettingsSection>
    </SettingsTabBody>
  );
}

type Platform = 'ios' | 'android' | 'safari-mac' | 'chromium' | 'firefox' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Firefox\//i.test(ua)) return 'firefox';
  if (/Edg\/|Chrome\/|Chromium\//i.test(ua)) return 'chromium';
  if (/Safari\//i.test(ua) && /Macintosh/i.test(ua)) return 'safari-mac';
  return 'other';
}

/** What to do when the browser won't offer its own one-click prompt. */
const INSTALL_STEPS: Record<Platform, { title: string; steps: string[] }> = {
  ios: { title: 'On iPhone or iPad', steps: ['Tap the Share button in Safari.', 'Choose “Add to Home Screen”.', 'Tap Add.'] },
  android: { title: 'On Android', steps: ['Open the browser menu (⋮).', 'Tap “Install app” or “Add to Home screen”.'] },
  'safari-mac': { title: 'In Safari on a Mac', steps: ['Open the File menu.', 'Choose “Add to Dock”.'] },
  chromium: {
    title: 'In Chrome or Edge',
    steps: ['Click the install icon at the right of the address bar — or open the browser menu.', 'Choose “Install DUMA”.'],
  },
  firefox: { title: 'In Firefox', steps: ['Firefox can’t install web apps. Open DUMA in Chrome, Edge or Safari to install it.'] },
  other: { title: 'In your browser', steps: ['Look for “Install app” or “Add to Home Screen” in the browser menu.'] },
};

function InstallRow() {
  const installPrompt = usePwaStore((state) => state.installPrompt);
  const installed = usePwaStore((state) => state.installed);
  const [standalone] = useState(isStandalone);
  const [platform] = useState(detectPlatform);
  const [showSteps, setShowSteps] = useState(false);

  async function install() {
    // The browser's own prompt when it has offered one; otherwise the steps for this browser.
    if (!installPrompt) {
      setShowSteps(true);
      return;
    }
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') usePwaStore.getState().setInstalled(true);
    // The prompt is single-use either way.
    usePwaStore.getState().setInstallPrompt(null);
  }

  const done = installed || standalone;
  const guide = INSTALL_STEPS[platform];

  return (
    <>
      <SettingRow
        icon={Download}
        title="Install the app"
        description={done ? 'Installed — DUMA opens in its own window.' : 'Opens full screen, like an app.'}
      >
        {done ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <CheckCircle2 size={16} aria-hidden="true" /> Installed
          </span>
        ) : (
          <Button size="sm" variant={installPrompt ? 'default' : 'outline'} onClick={() => void install()}>
            <Download aria-hidden="true" /> Install
          </Button>
        )}
      </SettingRow>
      {showSteps && (
        <Modal title="Install DUMA" description={guide.title} onClose={() => setShowSteps(false)}>
          <ol className="space-y-3">
            {guide.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-foreground">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={() => setShowSteps(false)}>
              Got it
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
