'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, LogOut, MapPin, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';

import { getLocationsByTenant, getTenants } from '@/lib/api/workspace.service';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">{title}</p>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const { logout } = useAuth();
  const { tenantId, locationId } = useWorkspaceStore();
  const { theme, setTheme } = useTheme();

  // next-themes is undefined until mounted — avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  return (
    <PageLayout eyebrow="Account" title="Settings">
      <div className="max-w-2xl flex flex-col gap-4">
        {/* Profile */}
        <Section title="Profile">
          <div className="flex items-center gap-4">
            <InitialsAvatar firstName={firstName} lastName={lastName} size="lg" />
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

        {/* Session */}
        <Section title="Session">
          <button
            onClick={logout}
            className="h-9 px-3 rounded-lg border border-destructive/30 text-destructive text-sm font-medium flex items-center gap-1.5 hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </Section>
      </div>
    </PageLayout>
  );
}
