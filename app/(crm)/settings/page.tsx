'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Building2,
  Calculator,
  Camera,
  CheckCircle2,
  CreditCard,
  Download,
  EyeOff,
  Globe,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Printer,
  ScanLine,
  Smartphone,
  Sun,
  Tags,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';

import { getSession, listSessions, revokeOtherSessions, revokeSession, type Session } from '@/lib/api/auth.service';
import { roleAtLeast } from '@/lib/api/staff.service';
import { getLocationsByTenant, getTenants } from '@/lib/api/workspace.service';
import { useAuth } from '@/lib/hooks/useAuth';
import { chime } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useKdsStore } from '@/stores/kdsStore';
import { usePosSettingsStore } from '@/stores/posSettingsStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { usePwaStore } from '@/stores/pwaStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  franchise_owner: 'Franchise Owner',
  store_manager: 'Store Manager',
  barista: 'Barista',
  hr_manager: 'HR Manager',
  marketing_manager: 'Marketing Manager',
  auditor: 'Auditor',
};

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
    <Section title="App">
      {installed || standalone ? (
        <p className="flex items-center gap-2 text-sm text-success font-medium">
          <CheckCircle2 size={16} aria-hidden="true" />
          Installed — DUMA is running as an app.
        </p>
      ) : installPrompt ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={install}
            className="w-fit h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download size={15} aria-hidden="true" />
            Install DUMA app
          </button>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">{title}</p>
      {children}
    </section>
  );
}

interface Connector {
  icon: LucideIcon;
  title: string;
  description: string;
}

const CONNECTORS: Connector[] = [
  {
    icon: Banknote,
    title: 'Payroll export',
    description: 'Send finalised payroll runs to your provider (Xero, QuickBooks, BrightPay).',
  },
  {
    icon: Printer,
    title: 'Receipt printer',
    description: 'Print order receipts to networked or Bluetooth thermal printers from the POS.',
  },
  {
    icon: Calculator,
    title: 'Accounting',
    description: 'Sync sales, COGS and payroll to your accounting software.',
  },
  {
    icon: CreditCard,
    title: 'Card payments',
    description: 'Take card payments through an integrated terminal (SumUp, Stripe Terminal).',
  },
  {
    icon: Tags,
    title: 'Label printer',
    description: 'Print prep and allergen labels for food items.',
  },
  {
    icon: Mail,
    title: 'Email / SMS',
    description: 'Send digital receipts and marketing via an email/SMS provider.',
  },
];

function ConnectorCard({ icon: Icon, title, description }: Connector) {
  return (
    <div aria-disabled="true" className="bg-card border border-border rounded-2xl p-5 opacity-60 cursor-not-allowed select-none">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Icon size={18} className="text-primary" aria-hidden="true" />
        </div>
        <Badge variant="muted" className="ml-auto shrink-0">
          Coming soon
        </Badge>
      </div>
      <p className="text-sm font-semibold text-foreground mt-4">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

/** Best-effort "Chrome · macOS"-style label + a phone/desktop icon from a UA string. */
function describeDevice(ua?: string | null): { label: string; icon: LucideIcon } {
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

/** "3 days ago" / "just now" from an ISO timestamp. Returns '' if unparseable. */
function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function SessionsSection() {
  const { logout } = useAuth();
  const qc = useQueryClient();

  const { data: current } = useQuery({
    queryKey: ['auth', 'current-session'],
    queryFn: () => getSession(),
  });
  const {
    data: sessions = [],
    isLoading,
    isError,
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
    <Section title="Active sessions">
        <div className="flex items-center justify-between gap-3 mb-3">
          {hasOthers && (
            <button
              onClick={() => revokeOthers.mutate()}
              disabled={revokeOthers.isPending}
              className="h-8 px-2.5 rounded-lg border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-1.5 hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              {revokeOthers.isPending ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOut size={13} aria-hidden="true" />
              )}
              Sign out all others
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Loading sessions…
          </p>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Couldn’t load your other sessions.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((s: Session) => {
              const { label, icon: Icon } = describeDevice(s.userAgent);
              const isCurrent = s.token === currentToken;
              const lastActive = relativeTime(s.updatedAt ?? s.createdAt);
              const meta = [s.ipAddress || null, lastActive ? `Active ${lastActive}` : null].filter(Boolean).join(' · ');
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-offset/40 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
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
                    <span className="text-xs text-muted-foreground shrink-0">Current</span>
                  ) : (
                    <button
                      onClick={() => revoke.mutate(s.token)}
                      disabled={revoke.isPending && revoke.variables === s.token}
                      className="h-8 px-2.5 rounded-lg border border-destructive/30 text-destructive text-xs font-medium flex items-center gap-1.5 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      {revoke.isPending && revoke.variables === s.token ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <LogOut size={13} aria-hidden="true" />
                      )}
                      Sign out
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
    </Section>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const { tenantId, locationId } = useWorkspaceStore();
  const { theme, setTheme } = useTheme();
  const { scannerMode, setScannerMode } = usePosSettingsStore();
  const { soundOn, setSoundOn } = useKdsStore();
  const { hidePageTitles, setHidePageTitles } = useUiSettingsStore();

  // next-themes is undefined until mounted — avoid a hydration mismatch.
  // (useSyncExternalStore: false during SSR/hydration, true right after.)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: getTenants,
    enabled: !!tenantId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const tenant = tenants.find((t) => t.id === tenantId);
  const location = locations.find((l) => l.id === locationId);

  const [firstName = '', lastName = ''] = (user?.name ?? '').split(' ');

  // Connectors are franchise-owner+ only (mirrors the old nav gating). Build the
  // tab list from what the current role can see so the segmented control never
  // shows a tab the user can't use.
  const showConnectors = roleAtLeast(role, 'franchise_owner');
  const TABS = [
    { value: 'general' as const, label: 'General' },
    { value: 'devices' as const, label: 'Devices' },
    ...(showConnectors ? [{ value: 'connectors' as const, label: 'Connectors' }] : []),
  ];
  const [tab, setTab] = useState<'general' | 'devices' | 'connectors'>('general');

  return (
    <PageLayout
      eyebrow="Account"
      title="Settings"
      headerSlot={<SegmentedControl options={TABS} value={tab} onChange={setTab} />}
    >
      <div>
        {tab === 'general' && (
          <div className="grid gap-4 md:grid-cols-2 items-start">
        {/* Profile */}
        <div className="md:col-span-2">
        <Section title="Profile">
          <div className="flex items-center gap-4">
            <InitialsAvatar firstName={firstName} lastName={lastName} email={user?.email} size="lg" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground truncate">{user?.name ?? '—'}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email ?? '—'}</p>
            </div>
            {role && (
              <Badge variant="muted" className="ml-auto shrink-0">
                {ROLE_LABEL[role] ?? role}
              </Badge>
            )}
          </div>
        </Section>
        </div>

        {/* Appearance */}
        <Section title="Appearance">
          <div className="flex flex-wrap gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                aria-pressed={mounted && theme === value}
                className={cn(
                  'h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
                  mounted && theme === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-offset',
                )}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => setHidePageTitles(!hidePageTitles)}
              aria-pressed={mounted && hidePageTitles}
              className={cn(
                'h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
                mounted && hidePageTitles
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-offset',
              )}
            >
              <EyeOff size={15} aria-hidden="true" />
              Hide page titles
            </button>
            <p className="text-xs text-muted-foreground mt-3">
              Hides the page title header (e.g. “Service Mode / Barista Display”) on every page to give content more room — handy on
              tablets. Search bars and tabs stay visible. Saved per device.
            </p>
          </div>
        </Section>

        {/* Workspace */}
        <Section title="Workspace">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Building2 size={15} className="text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Workspace</p>
                <p className="text-sm text-foreground truncate">{tenant?.name ?? tenantId ?? 'None selected'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <MapPin size={15} className="text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active location</p>
                <p className="text-sm text-foreground truncate">{location?.name ?? 'None selected'}</p>
              </div>
            </div>
            <Link href="/workspaces" className="text-sm font-medium text-primary hover:underline w-fit">
              Manage workspaces & locations →
            </Link>
          </div>
        </Section>

        {/* Session — sign out + other active sessions */}
        <div className="md:col-span-2">
          <SessionsSection />
        </div>
          </div>
        )}

        {tab === 'devices' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
        {/* POS (per-device) */}
        <Section title="POS">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Loyalty QR scanner</p>
          <div className="flex flex-wrap gap-2">
            {SCANNER_MODES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setScannerMode(value)}
                aria-pressed={mounted && scannerMode === value}
                className={cn(
                  'h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
                  mounted && scannerMode === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-offset',
                )}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            How the POS reads customer loyalty codes. External scanner supports USB/Bluetooth scanners that type like a keyboard. This
            setting is saved per device.
          </p>
        </Section>

        {/* Barista display (per-device) */}
        <Section title="Barista Display">
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              // The click is our user gesture — unlock the AudioContext now and
              // play a confirmation chime so the barista hears that it works.
              if (next) chime();
            }}
            aria-pressed={mounted && soundOn}
            className={cn(
              'h-9 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
              mounted && soundOn
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-offset',
            )}
          >
            {mounted && soundOn ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            New-order chime
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            Plays a chime on the barista display when a new order arrives. Saved per device.
          </p>
        </Section>

        {/* Install as app (PWA) */}
        <div className="md:col-span-2 lg:col-span-1">
          <InstallAppSection />
        </div>
          </div>
        )}

        {tab === 'connectors' && showConnectors && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground max-w-2xl">
              Connect external services to automate payroll exports, receipt printing and accounting.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CONNECTORS.map((connector) => (
                <ConnectorCard key={connector.title} {...connector} />
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Integrations are coming soon — this is where you&apos;ll connect hardware and services.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
