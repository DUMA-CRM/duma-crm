'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  Download,
  Globe,
  type IconComponent,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Plug,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sun,
  Volume2,
  VolumeX,
} from '@/components/icons';
import { AgentModelSettings } from '@/components/settings/AgentModelSettings';
import { QrOrderingSettings } from '@/components/settings/QrOrderingSettings';
import { SettingsSection as Section } from '@/components/settings/SettingsSection';
import { ConnectorsGrid } from '@/components/settings/connectors/ConnectorsGrid';
import { relativeTime } from '@/components/settings/connectors/shared';
import { LocationList } from '@/components/settings/workspaces/LocationList';
import { ModuleManagement } from '@/components/settings/workspaces/ModuleManagement';
import { WorkspaceList } from '@/components/settings/workspaces/WorkspaceList';
import { EditorShell } from '@/components/shared/EditorShell';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type Session,
  changeEmail,
  changePassword,
  getSession,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from '@/lib/api/auth.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { MIN_PASSWORD_LENGTH, passwordLengthHint } from '@/lib/auth/password-policy';
import { useTenants } from '@/lib/hooks/useTenants';
import { chime } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useKdsStore } from '@/stores/kdsStore';
import { usePosSettingsStore } from '@/stores/posSettingsStore';
import { usePwaStore } from '@/stores/pwaStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

const SCANNER_MODES = [
  { value: 'camera', label: 'Device camera', icon: Camera },
  { value: 'external', label: 'External scanner', icon: ScanLine },
] as const;

/** Detects whether the app is already running as an installed PWA. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true);
}

function InstallAppSection() {
  const installPrompt = usePwaStore((s) => s.installPrompt);
  const installed = usePwaStore((s) => s.installed);
  const [standalone] = useState(isStandalone);
  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') usePwaStore.getState().setInstalled(true);
    // The prompt is single-use either way.
    usePwaStore.getState().setInstallPrompt(null);
  }

  return (
    <Section
      title="Install DUMA"
      description="Run DUMA full-screen on this device and keep the essential experience available through brief connection drops."
    >
      {installed || standalone ? (
        <p className="flex items-center gap-2 text-sm text-success font-medium">
          <CheckCircle2 size={16} aria-hidden="true" />
          Installed — DUMA is running as an app.
        </p>
      ) : installPrompt ? (
        <div className="flex flex-col gap-2">
          <Button onClick={install} className="w-fit">
            <Download size={15} aria-hidden="true" />
            Install DUMA app
          </Button>
          <p className="text-xs text-muted-foreground">
            Installs to the home screen / desktop and runs full-screen — ideal for POS and barista tablets, and keeps working through Wi-Fi
            blips.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {isIos
            ? 'On iPhone/iPad: open the Share menu and choose "Add to Home Screen" to install DUMA as an app.'
            : 'Installation isn’t available right now. If DUMA is already installed on this device, Chrome hides the option — otherwise use Chrome/Edge over HTTPS and check the install icon in the address bar.'}
        </p>
      )}
    </Section>
  );
}

/**
 * A setting you switch on or off. Reads as a labelled row with its state on the
 * right, rather than a chip whose colour you have to interpret.
 */
function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 gap-3">
        <Icon size={16} className={cn('mt-0.5 shrink-0', checked ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={onChange}
        className={cn(
          'mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-rule bg-muted',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'ml-0.5 size-4.5 rounded-full bg-card shadow-sm transition-transform',
            checked ? 'translate-x-4 bg-white' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

/** Best-effort "Chrome · macOS"-style label + a phone/desktop icon from a UA string. */
function describeDevice(ua?: string | null): { label: string; icon: IconComponent } {
  if (!ua) return { label: 'Unknown device', icon: Globe };
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Mac OS X|Macintosh/i.test(ua)
        ? 'macOS'
        : /Android/i.test(ua)
          ? 'Android'
          : /Linux/i.test(ua)
            ? 'Linux'
            : '';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/i.test(ua)
      ? 'Opera'
      : /Firefox\//i.test(ua)
        ? 'Firefox'
        : /Chrome\//i.test(ua) && !/Chromium/i.test(ua)
          ? 'Chrome'
          : /Safari\//i.test(ua) && !/Chrome/i.test(ua)
            ? 'Safari'
            : 'Browser';
  const isMobile = /Mobile|iPhone|iPod|Android/i.test(ua);
  return { label: [browser, os].filter(Boolean).join(' · '), icon: isMobile ? Smartphone : Monitor };
}

function SessionsSection() {
  const qc = useQueryClient();

  const { data: current } = useQuery({
    queryKey: ['auth', 'current-session'],
    queryFn: () => getSession(),
  });
  const {
    data: sessions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: listSessions,
  });

  const revoke = useMutation({
    mutationFn: (token: string) => revokeSession(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });

  const currentToken = current?.session.token;
  // Current device first, then the rest by most-recently-active.
  const sorted = [...sessions].sort((a, b) => {
    if (a.token === currentToken) return -1;
    if (b.token === currentToken) return 1;
    return (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '');
  });
  const hasOthers = sessions.some((s) => s.token !== currentToken);

  return (
    <Section
      title="Signed-in devices"
      actions={
        hasOthers ? (
          <Button variant="destructive" size="sm" onClick={() => revokeOthers.mutate()} disabled={revokeOthers.isPending}>
            {revokeOthers.isPending ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <LogOut size={13} aria-hidden="true" />
            )}
            Sign out all others
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Loading sessions…
        </p>
      ) : isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/5 px-3 py-2.5">
          <p className="text-sm text-destructive">Couldn’t load your signed-in devices.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions were returned.</p>
      ) : (
        <ul className="divide-y divide-rule/45">
          {sorted.map((s: Session) => {
            const { label, icon: Icon } = describeDevice(s.userAgent);
            const isCurrent = s.token === currentToken;
            const lastActive = relativeTime(s.updatedAt ?? s.createdAt);
            const meta = [s.ipAddress || null, lastActive ? `Active ${lastActive}` : null].filter(Boolean).join(' · ');
            return (
              <li key={s.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <div className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
                  <Icon size={15} className="text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate flex items-center gap-2">
                    {label}
                    {isCurrent && (
                      <Badge variant="muted" className="shrink-0">
                        This device
                      </Badge>
                    )}
                  </p>
                  {meta && <p className="text-xs text-muted-foreground truncate">{meta}</p>}
                </div>
                {isCurrent ? (
                  <span className="shrink-0 text-xs font-medium text-success">Active now</span>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => revoke.mutate(s.token)}
                    disabled={revoke.isPending && revoke.variables === s.token}
                  >
                    {revoke.isPending && revoke.variables === s.token ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <LogOut size={13} aria-hidden="true" />
                    )}
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export type SettingsTab = 'general' | 'security' | 'workspaces' | 'connectors' | 'qr-ordering';

function EmailSection() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const normalized = email.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  const changed = valid && normalized !== user?.email.toLowerCase();

  const mutation = useMutation({
    mutationFn: () => changeEmail(normalized, `${window.location.origin}/settings/security`),
    onSuccess: (result) => {
      if (result.user) setUser(result.user);
    },
  });

  return (
    <Section title="Sign-in email">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Mail size={16} className="text-muted-foreground" aria-hidden="true" />
          <span className="font-medium text-foreground">{user?.email ?? 'No email available'}</span>
          <Badge variant={user?.emailVerified ? 'success' : 'muted'}>{user?.emailVerified ? 'Verified' : 'Not verified'}</Badge>
        </div>

        {mutation.error && (
          <p role="alert" className="rounded-md bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status" className="rounded-md bg-success-highlight px-3 py-2.5 text-sm text-success">
            {mutation.data.user || mutation.data.message === 'Email updated'
              ? 'Email changed successfully.'
              : `Check ${normalized} to confirm the change.`}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              label="New email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                mutation.reset();
              }}
              placeholder="name@example.com"
              aria-invalid={Boolean(email && !valid)}
              hint={email && !valid ? 'Enter a complete email address.' : undefined}
            />
          </div>
          <Button type="submit" className="sm:mb-px" disabled={!changed || mutation.isPending || mutation.isSuccess}>
            {mutation.isPending ? 'Updating…' : mutation.isSuccess ? 'Email sent' : 'Change email'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
  return (
    <Section title="Password">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {mutation.error && (
          <p role="alert" className="rounded-md bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status" className="rounded-md bg-success-highlight px-3 py-2.5 text-sm text-success">
            Password changed. Other sessions were signed out.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            hint={passwordLengthHint(next)}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={Boolean(confirm && next !== confirm)}
            hint={confirm && next !== confirm ? 'Passwords do not match yet.' : undefined}
          />
        </div>
        <Button type="submit" disabled={!current || next.length < MIN_PASSWORD_LENGTH || next !== confirm || mutation.isPending}>
          {mutation.isPending ? 'Changing password…' : 'Change password'}
        </Button>
      </form>
    </Section>
  );
}

/** Each tab is its own route, so “Settings → Connectors” can be linked to directly. */
const TAB_PATH: Record<SettingsTab, string> = {
  general: '/settings',
  security: '/settings/security',
  workspaces: '/settings/workspaces',
  connectors: '/settings/connectors',
  'qr-ordering': '/settings/qr-ordering',
};

const TAB_DETAILS: Record<SettingsTab, { label: string; description: string; icon: IconComponent }> = {
  general: { label: 'General', description: 'Appearance, this device and your current context', icon: Smartphone },
  security: { label: 'Security', description: 'Email, password and sessions', icon: ShieldCheck },
  workspaces: { label: 'Workspaces', description: 'Businesses and the locations they trade from', icon: Building2 },
  connectors: { label: 'Connectors', description: 'Email, payments and exports', icon: Plug },
  'qr-ordering': { label: 'QR ordering', description: 'Customer menu, checkout options and publishing', icon: QrCode },
};

function SettingsNavigation({
  active,
  showOwnerTabs,
  showQrOrdering,
  onChange,
}: {
  active: SettingsTab;
  showOwnerTabs: boolean;
  showQrOrdering: boolean;
  onChange: (tab: SettingsTab) => void;
}) {
  // Personal first, then the business-wide tabs an owner also administers.
  const items: SettingsTab[] = [
    'general',
    'security',
    ...(showOwnerTabs ? (['workspaces', 'connectors'] as const) : []),
    ...(showQrOrdering ? (['qr-ordering'] as const) : []),
  ];

  return (
    <nav aria-label="Settings sections" className="max-w-full overflow-x-auto">
      <div className="flex min-w-max gap-1 rounded-md bg-band/70 p-1" role="tablist">
        {items.map((item) => {
          const detail = TAB_DETAILS[item];
          const Icon = detail.icon;
          const selected = active === item;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item)}
              className={cn(
                'flex h-9 min-w-max items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
                selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              )}
            >
              <Icon size={15} className={selected ? 'text-primary' : undefined} aria-hidden="true" />
              {detail.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; icon: IconComponent }[];
  value?: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={label}>
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(optionValue)}
            className={cn(
              'flex min-h-11 items-center gap-2.5 rounded-md border px-3 text-sm font-medium transition-colors',
              selected
                ? 'border-primary/50 bg-measured/6 text-foreground'
                : 'border-rule/65 bg-background/40 text-muted-foreground hover:border-rule hover:bg-band/60 hover:text-foreground',
            )}
          >
            <Icon size={16} className={selected ? 'text-primary' : undefined} aria-hidden="true" />
            {optionLabel}
            {selected && <CheckCircle2 size={15} className="ml-auto text-success" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsWorkspace({ tab }: { tab: SettingsTab }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const capabilities = useAuthStore((s) => s.capabilities);
  const { tenantId, locationId } = useWorkspaceStore();
  const { theme, setTheme } = useTheme();
  const { scannerMode, setScannerMode } = usePosSettingsStore();
  const { soundOn, setSoundOn } = useKdsStore();

  // next-themes is undefined until mounted — avoid a hydration mismatch.
  // (useSyncExternalStore: false during SSR/hydration, true right after.)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const { tenants } = useTenants({ enabled: !!tenantId });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const tenant = tenants.find((t) => t.id === tenantId);
  const location = locations.find((l) => l.id === locationId);

  const [firstName = '', lastName = ''] = (user?.name ?? '').split(' ');

  // Workspaces and connectors are franchise-owner+ only (mirrors the old nav
  // gating), so neither tab appears for a role that cannot use it.
  const showOwnerTabs = hasCapability(capabilities, 'settings:write');
  const showQrOrdering = hasCapability(capabilities, 'qr-ordering:read');
  // A stale link to an owner tab without the role falls back to general.
  const active: SettingsTab =
    ((tab === 'connectors' || tab === 'workspaces') && !showOwnerTabs) || (tab === 'qr-ordering' && !showQrOrdering) ? 'general' : tab;
  const activeDetails = TAB_DETAILS[active];

  return (
    <EditorShell
      eyebrow="Account"
      title="Settings"
      leading={<InitialsAvatar firstName={firstName || 'U'} lastName={lastName} email={user?.email} className="size-9" />}
      actions={
        <SettingsNavigation
          active={active}
          showOwnerTabs={showOwnerTabs}
          showQrOrdering={showQrOrdering}
          onChange={(next) => router.push(TAB_PATH[next])}
        />
      }
    >
      <div className="min-w-0">
        <header className="mb-5 px-1">
          <h2 className="text-xl font-semibold tracking-title text-foreground">{activeDetails.label}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{activeDetails.description}</p>
        </header>

        {/* Everything that is personal to you on this device — appearance, the
            terminal's own behaviour, and a read-out of the context you're in.
            Two packed columns rather than grid cells: panels differ in height, and
            a grid row would leave a dead band under every shorter one. */}
        {active === 'general' && (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <Section title="Appearance" description="Choose how DUMA looks on this device.">
                <ChoiceGroup label="Colour theme" options={THEMES} value={mounted ? theme : undefined} onChange={setTheme} />
              </Section>

              <Section
                title="Loyalty scanner"
                description="Choose how this POS reads customer QR codes. External mode supports USB and Bluetooth scanners that type like a keyboard."
                footnote="Stored on this device only — every terminal is set separately."
              >
                <ChoiceGroup
                  label="Loyalty scanner mode"
                  options={SCANNER_MODES}
                  value={mounted ? scannerMode : undefined}
                  onChange={setScannerMode}
                />
              </Section>

              <AgentModelSettings />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <Section title="Current workspace" description="Settings and connected services are applied in this business context.">
                {/* A read-out, not a status: neutral glyphs. Domain colour is
                    reserved for the domains that own it. */}
                <dl className="divide-y divide-rule/45">
                  <div className="flex items-center gap-3 pb-3.5">
                    <Building2 size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Workspace</dt>
                      <dd className="truncate text-sm font-medium text-foreground">{tenant?.name ?? tenantId ?? 'None selected'}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 py-3.5">
                    <MapPin size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Active location</dt>
                      <dd className="truncate text-sm font-medium text-foreground">{location?.name ?? 'None selected'}</dd>
                    </div>
                  </div>
                </dl>
                {/* Only an owner can change the organisation, so only an owner is
                    offered the way there. */}
                {showOwnerTabs && (
                  <Button asChild variant="outline" className="mt-1 w-full justify-between">
                    <Link href={TAB_PATH.workspaces}>
                      Manage workspaces and locations <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </Section>

              <Section title="Barista display" description="Set the feedback this device gives the team when new work arrives.">
                <ToggleRow
                  icon={mounted && soundOn ? Volume2 : VolumeX}
                  title="New-order chime"
                  description="Plays once when a new order arrives. Turning it on also plays a preview at the current volume."
                  checked={mounted && soundOn}
                  onChange={() => {
                    const next = !soundOn;
                    setSoundOn(next);
                    if (next) chime();
                  }}
                />
              </Section>

              <InstallAppSection />
            </div>
          </div>
        )}

        {/* One panel per concern, in two packed columns: the account forms on the
            left, the device list — the tallest and the widest read — on the right. */}
        {active === 'security' && (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <EmailSection />
              <PasswordSection />
            </div>
            <SessionsSection />
          </div>
        )}

        {/* Workspace then location, left to right: the second list depends on the
            first, so the reading order is the setup order. */}
        {active === 'workspaces' && showOwnerTabs && (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <WorkspaceList />
            <LocationList />
            {role === 'super_admin' && (
              <div className="xl:col-span-2">
                <ModuleManagement />
              </div>
            )}
          </div>
        )}

        {active === 'connectors' && showOwnerTabs && <ConnectorsGrid />}
        {active === 'qr-ordering' && showQrOrdering && <QrOrderingSettings />}
      </div>
    </EditorShell>
  );
}
