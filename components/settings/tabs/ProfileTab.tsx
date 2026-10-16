'use client';

import { useTheme } from 'next-themes';
import { useState, useSyncExternalStore } from 'react';

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  Globe,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Plus,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Sun,
} from '@/components/icons';
import { SettingsChoice } from '@/components/settings/SettingsChoice';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Fact, SettingRow, SettingRows } from '@/components/settings/controls';
import { IconTag } from '@/components/shared/IconTag';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Logo } from '@/components/shared/Logo';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { usePwaStore } from '@/stores/pwaStore';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
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
    <SettingsTabBody>
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
              {user && (
                <IconTag
                  icon={user.emailVerified ? ShieldCheck : ShieldOff}
                  label={user.emailVerified ? 'Email verified' : 'Email not verified'}
                  tone={user.emailVerified ? 'success' : 'muted'}
                />
              )}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <Fact icon={ShieldCheck} label="Role" value={role ? humanise(role) : '—'} />
          <Fact icon={Building2} label="Workspace" value={tenant?.name ?? '—'} />
          <Fact icon={MapPin} label="Location" value={location?.name ?? 'None selected'} />
          <Fact icon={CalendarDays} label="Member since" value={formatInstant(user?.createdAt, { month: 'long', year: 'numeric' })} />
        </dl>
      </SettingsSection>

      <SettingsSection>
        <SettingsChoice label="Colour theme" value={mounted ? theme : undefined} onChange={setTheme} options={THEMES} />
      </SettingsSection>
      <SettingsSection>
        <SettingRows>
          <InstallRow />
        </SettingRows>
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

function InstallDeviceIcon({ platform, size = 18 }: { platform: Platform; size?: number }) {
  const DeviceIcon =
    platform === 'ios' || platform === 'android' ? Smartphone : platform === 'other' || platform === 'firefox' ? Globe : Monitor;
  return <DeviceIcon size={size} aria-hidden="true" />;
}

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
      <SettingRow icon={Download} title="Install the app">
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
        <Modal
          title="Install DUMA"
          size="lg"
          onClose={() => setShowSteps(false)}
          illustration={
            <div className="relative flex h-28 w-full max-w-[18rem] items-center justify-center" aria-hidden="true">
              <div className="w-full overflow-hidden rounded-xl border border-rule bg-field shadow-sm">
                <div className="flex h-8 items-center gap-1.5 border-b border-rule/70 bg-band/65 px-3">
                  <span className="size-1.5 rounded-full bg-muted-foreground/35" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/35" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/35" />
                  <span className="ml-2 flex h-5 min-w-0 flex-1 items-center justify-center rounded-md border border-rule/60 bg-card px-2 text-[10px] font-medium text-muted-foreground">
                    Your DUMA workspace
                  </span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <Logo size={40} className="rounded-[19.4%] shadow-sm" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">DUMA</p>
                    <p className="text-xs text-muted-foreground">Your workspace, ready</p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-rule bg-card text-primary">
                    <InstallDeviceIcon platform={platform} />
                  </span>
                </div>
              </div>
              <span className="absolute -right-2 -top-1 flex size-8 items-center justify-center rounded-full border border-rule bg-card text-primary shadow-sm">
                <Plus size={16} />
              </span>
            </div>
          }
          footer={
            <Button className="w-full" onClick={() => setShowSteps(false)}>
              Got it
            </Button>
          }
        >
          {platform !== 'firefox' && (
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <InstallDeviceIcon platform={platform} />
              </span>
              <span>{guide.title}</span>
            </div>
          )}
          {platform === 'firefox' ? (
            <div role="note" className="flex items-start gap-3 rounded-lg border border-rule/70 bg-band/45 px-4 py-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-field text-muted-foreground">
                <Globe size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Firefox doesn’t support app installation</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">Open DUMA in Chrome, Edge or Safari to install it.</p>
              </div>
            </div>
          ) : (
            <ol className="space-y-2.5">
              {guide.steps.map((step, index) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-lg border border-rule/70 bg-field/60 px-3.5 py-3 text-sm leading-5 text-foreground"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}
    </>
  );
}
