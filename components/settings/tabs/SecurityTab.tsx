'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import {
  Globe,
  type IconComponent,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { MIN_PASSWORD_LENGTH, passwordLengthHint } from '@/lib/auth/password-policy';
import {
  type Session,
  changeEmail,
  changePassword,
  getSession,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from '@/lib/modules/identity/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

const EASE = [0.16, 1, 0.3, 1] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SecurityTab() {
  const [open, setOpen] = useState<'email' | 'password' | null>(null);
  const toggle = (row: 'email' | 'password') => setOpen((current) => (current === row ? null : row));

  return (
    <SettingsTabBody aside={<DevicesSection />}>
      <SettingsSection title="Sign-in">
        <div className="divide-y divide-rule/40">
          <EmailRow open={open === 'email'} onToggle={() => toggle('email')} onDone={() => setOpen(null)} />
          <PasswordRow open={open === 'password'} onToggle={() => toggle('password')} onDone={() => setOpen(null)} />
        </div>
      </SettingsSection>
    </SettingsTabBody>
  );
}

/** Icon tile, label and value, with a Change button that opens its form in place. */
function CredentialRow({
  icon: Icon,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  icon: IconComponent;
  label: string;
  value: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label uppercase text-muted-foreground">{label}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">{value}</div>
        </div>
        <Button variant={open ? 'ghost' : 'outline'} size="sm" onClick={onToggle} aria-expanded={open}>
          {open ? 'Cancel' : 'Change'}
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-4 sm:pl-13">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmailRow({ open, onToggle, onDone }: { open: boolean; onToggle: () => void; onDone: () => void }) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const normalized = email.trim().toLowerCase();
  const valid = EMAIL_PATTERN.test(normalized);
  const changed = valid && normalized !== user?.email.toLowerCase();

  const mutation = useMutation({
    mutationFn: () => changeEmail(normalized, `${window.location.origin}/settings/security`),
    onSuccess: (result) => {
      if (result.user) setUser(result.user);
      toast('success', result.user || result.message === 'Email updated' ? 'Email changed.' : `Check ${normalized} to confirm the change.`);
      setEmail('');
      onDone();
    },
  });

  return (
    <CredentialRow
      icon={Mail}
      label="Email"
      open={open}
      onToggle={() => {
        mutation.reset();
        onToggle();
      }}
      value={
        <>
          <span className="truncate">{user?.email ?? '—'}</span>
          {user && (
            <IconTag
              icon={user.emailVerified ? ShieldCheck : ShieldOff}
              label={user.emailVerified ? 'Email verified' : 'Email not verified'}
              tone={user.emailVerified ? 'success' : 'muted'}
            />
          )}
        </>
      }
    >
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            label="New email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              mutation.reset();
            }}
            placeholder="name@example.com"
            error={mutation.error?.message ?? (email && !valid ? 'Enter a complete email address.' : undefined)}
          />
        </div>
        <Button type="submit" className="sm:mt-6" disabled={!changed || mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save
        </Button>
      </form>
    </CredentialRow>
  );
}

function PasswordRow({ open, onToggle, onDone }: { open: boolean; onToggle: () => void; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
  };
  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      reset();
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('auth') });
      toast('success', 'Password changed. Other devices were signed out.');
      onDone();
    },
  });
  const strength = Math.min(1, next.length / MIN_PASSWORD_LENGTH);
  const mismatch = Boolean(confirm) && next !== confirm;

  return (
    <CredentialRow
      icon={KeyRound}
      label="Password"
      open={open}
      onToggle={() => {
        reset();
        mutation.reset();
        onToggle();
      }}
      value={<span className="tracking-[0.2em] text-muted-foreground">••••••••••••</span>}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          error={mutation.error?.message}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              hint={passwordLengthHint(next)}
            />
            <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-band" aria-hidden="true">
              <div
                className={cn('h-full transition-[width] duration-300', strength >= 1 ? 'bg-success' : 'bg-rule')}
                style={{ width: `${strength * 100}%` }}
              />
            </div>
          </div>
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={mismatch ? 'The passwords don’t match yet.' : undefined}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">You’ll stay signed in here; other devices are signed out.</p>
          <Button type="submit" disabled={!current || next.length < MIN_PASSWORD_LENGTH || next !== confirm || mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Change password
          </Button>
        </div>
      </form>
    </CredentialRow>
  );
}

/** Best-effort "Chrome · macOS" label and a phone/desktop glyph from a user-agent string. */
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

function DevicesSection() {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const sessionsKey = moduleQueryKeys.identity.key('auth', 'sessions');
  const { data: current } = useQuery({
    queryKey: moduleQueryKeys.identity.key('auth', 'current-session'),
    queryFn: () => getSession(),
  });
  const sessions = useQuery({ queryKey: sessionsKey, queryFn: listSessions });
  const revoke = useMutation({
    mutationFn: (token: string) => revokeSession(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionsKey }),
    onError: (error) => toast('error', error.message),
  });
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sessionsKey });
      toast('success', 'Signed out of every other device.');
    },
    onError: (error) => toast('error', error.message),
  });

  const currentToken = current?.session.token;
  // This device first, then the rest by most recently active.
  const sorted = [...(sessions.data ?? [])].sort((a, b) => {
    if (a.token === currentToken) return -1;
    if (b.token === currentToken) return 1;
    return (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '');
  });
  const others = sorted.filter((session) => session.token !== currentToken).length;

  return (
    <SettingsSection
      title="Devices"
      actions={
        sessions.isSuccess ? <span className="text-xs tabular-nums text-muted-foreground">{sorted.length} signed in</span> : undefined
      }
    >
      {sessions.isPending ? (
        <TilesSkeleton count={2} label="Loading devices" />
      ) : sessions.isError ? (
        <ErrorState title="Couldn’t load your devices" onRetry={() => void sessions.refetch()} />
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions were returned.</p>
      ) : (
        <>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {sorted.map((session: Session, index) => {
                const { label, icon: Icon } = describeDevice(session.userAgent);
                const isCurrent = session.token === currentToken;
                const lastActive = session.updatedAt ?? session.createdAt;
                const pending = revoke.isPending && revoke.variables === session.token;
                return (
                  <motion.li
                    key={session.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : index * 0.05 } }}
                    exit={{ opacity: 0, x: 16 }}
                    aria-current={isCurrent || undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3.5 py-3',
                      isCurrent ? 'border-primary/40 bg-primary/5' : 'border-rule/50 bg-background/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-md',
                        isCurrent ? 'bg-primary text-primary-foreground' : 'bg-band text-muted-foreground',
                      )}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">{label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {/* One line: which this is, when it was last used, from where. */}
                        {isCurrent ? (
                          'This device'
                        ) : lastActive ? (
                          <>
                            Active <RelativeTime iso={lastActive} />
                          </>
                        ) : (
                          'Signed in'
                        )}
                        {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                      </p>
                    </div>
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-exception"
                        onClick={() => revoke.mutate(session.token)}
                        disabled={pending}
                        aria-label={`Sign out ${label}`}
                      >
                        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
                      </Button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {others > 0 && (
            <Button variant="destructive" className="mt-4 w-full" onClick={() => revokeOthers.mutate()} disabled={revokeOthers.isPending}>
              {revokeOthers.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
              Sign out {others === 1 ? 'the other device' : `all ${others} other devices`}
            </Button>
          )}
        </>
      )}
    </SettingsSection>
  );
}
