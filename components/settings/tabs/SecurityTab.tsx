'use client';

import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

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
import { ChangeRow } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { MIN_PASSWORD_LENGTH, passwordLengthHint } from '@/lib/auth/password-policy';
import { ApiError } from '@/lib/modules/core/client';
import {
  type LinkedAccount,
  type Session,
  changeEmail,
  changePassword,
  getSession,
  listLinkedAccounts,
  listSessions,
  requestPasswordReset,
  revokeOtherSessions,
  revokeSession,
  startGoogleLink,
  unlinkAccount,
} from '@/lib/modules/identity/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { canReadSessionList } from '@/lib/utils/session-freshness';
import { googleLinkError } from '@/lib/utils/sign-in';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountsKey = moduleQueryKeys.identity.key('auth', 'accounts');

/** Where "Sign in again" returns to, for a change that needs a recent sign-in. */
const recentSignInHref = () => `/sign-in?next=${encodeURIComponent(window.location.pathname)}&reason=recent-sign-in`;
const notFresh = (error: unknown) => error instanceof ApiError && error.status === 403 && error.code === 'SESSION_NOT_FRESH';

export function SecurityTab() {
  const [open, setOpen] = useState<'email' | 'password' | null>(null);
  const toggle = (row: 'email' | 'password') => setOpen((current) => (current === row ? null : row));
  const accounts = useQuery({ queryKey: accountsKey, queryFn: listLinkedAccounts, meta: { silentError: true } });

  return (
    <SettingsTabBody>
      <SettingsSection title="Sign-in">
        <div>
          <EmailRow open={open === 'email'} onToggle={() => toggle('email')} onDone={() => setOpen(null)} />
          <PasswordRow
            hasPassword={accounts.data ? accounts.data.some((account) => account.providerId === 'credential') : true}
            open={open === 'password'}
            onToggle={() => toggle('password')}
            onDone={() => setOpen(null)}
          />
          <GoogleRow accounts={accounts} />
        </div>
      </SettingsSection>
      <ActiveSessionsSection />
    </SettingsTabBody>
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
    mutationFn: () => changeEmail(normalized, `${window.location.origin}/verify-email?flow=change-email`),
    onSuccess: (result) => {
      if (result.user) setUser(result.user);
      toast('success', result.user || result.message === 'Email updated' ? 'Email changed.' : `Check ${normalized} to confirm the change.`);
      setEmail('');
      onDone();
    },
  });

  return (
    <ChangeRow
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
    </ChangeRow>
  );
}

function PasswordRow({ hasPassword, ...props }: { hasPassword: boolean; open: boolean; onToggle: () => void; onDone: () => void }) {
  return hasPassword ? <ChangePasswordRow {...props} /> : <SetPasswordRow />;
}

/** Signs in with Google only: a password is set through the same emailed link as a reset. */
function SetPasswordRow() {
  const email = useAuthStore((state) => state.user?.email);
  const send = useMutation({
    mutationFn: () => requestPasswordReset(email!, `${window.location.origin}/reset-password`),
    onSuccess: () => toast('success', `Check ${email} for a link to set your password.`),
    onError: (error) => toast('error', error.message),
  });
  return (
    <ChangeRow
      icon={KeyRound}
      label="Password"
      value={<span className="text-muted-foreground">Not set — you sign in with Google</span>}
      trailing={
        <Button variant="outline" size="sm" disabled={!email || send.isPending || send.isSuccess} onClick={() => send.mutate()}>
          {send.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {send.isSuccess ? 'Email sent' : 'Set a password'}
        </Button>
      }
    />
  );
}

function ChangePasswordRow({ open, onToggle, onDone }: { open: boolean; onToggle: () => void; onDone: () => void }) {
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
    <ChangeRow
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
    </ChangeRow>
  );
}

/** Google's "G" in its own four colours, sized like the other row icons. */
const GoogleLogo: IconComponent = ({ size = 18 }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/**
 * Connect or disconnect Google. Connecting leaves for Google and comes back to
 * this page with `?linked=google` or `?error=CODE`. Disconnecting the only way
 * to sign in is refused — set a password first.
 */
function GoogleRow({ accounts }: { accounts: UseQueryResult<LinkedAccount[]> }) {
  const qc = useQueryClient();
  const [stale, setStale] = useState(false);
  const google = accounts.data?.find((account) => account.providerId === 'google');
  const onlyWay = Boolean(google) && accounts.data?.length === 1;

  // The round trip back from Google: say what happened once, then tidy the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get('linked') === 'google';
    const error = linked ? null : googleLinkError(params.get('error'));
    if (!linked && !error) return;
    if (linked) toast('success', 'Google connected. You can now sign in with it.');
    else toast('error', error!);
    params.delete('linked');
    params.delete('error');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    void qc.invalidateQueries({ queryKey: accountsKey });
  }, [qc]);

  const connect = useMutation({
    mutationFn: () => {
      const here = new URL(window.location.href);
      here.search = '';
      return startGoogleLink(`${here.href}?linked=google`, here.href);
    },
    onSuccess: (url) => window.location.assign(url),
    onError: (error) => (notFresh(error) ? setStale(true) : toast('error', error.message)),
  });
  const disconnect = useMutation({
    mutationFn: () => unlinkAccount('google', google!.accountId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountsKey });
      toast('success', 'Google disconnected.');
    },
    onError: (error) => (notFresh(error) ? setStale(true) : toast('error', error.message)),
  });

  return (
    <ChangeRow
      icon={GoogleLogo}
      label="Google"
      value={
        accounts.isPending ? <span className="text-muted-foreground">Checking…</span>
          : accounts.isError ? <span className="text-muted-foreground">Couldn’t check</span>
            : stale ? <span className="text-muted-foreground">Sign in again to change this</span>
              : google ? <span>Connected <span className="font-normal text-muted-foreground">since {formatInstant(google.createdAt, { dateStyle: 'medium' })}</span></span>
                : <span className="text-muted-foreground">Not connected</span>
      }
      trailing={
        accounts.isError ? (
          <Button variant="ghost" size="sm" onClick={() => void accounts.refetch()}>Retry</Button>
        ) : stale ? (
          <Button variant="outline" size="sm" onClick={() => window.location.assign(recentSignInHref())}>Sign in again</Button>
        ) : google ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={onlyWay || disconnect.isPending}
            title={onlyWay ? 'Set a password first — Google is your only way to sign in.' : undefined}
            onClick={() => disconnect.mutate()}
          >
            {disconnect.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Disconnect
          </Button>
        ) : accounts.isSuccess ? (
          <Button variant="outline" size="sm" disabled={connect.isPending} onClick={() => connect.mutate()}>
            {connect.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Connect
          </Button>
        ) : undefined
      }
    />
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

function ActiveSessionsSection() {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const sessionsKey = moduleQueryKeys.identity.key('auth', 'sessions');
  const currentQuery = useQuery({
    queryKey: moduleQueryKeys.identity.key('auth', 'current-session'),
    queryFn: () => getSession(),
  });
  const current = currentQuery.data;
  const canList = canReadSessionList(current);
  const sessions = useQuery({
    queryKey: sessionsKey,
    queryFn: listSessions,
    enabled: canList,
    // This section provides its own retry and recent-sign-in states.
    meta: { silentError: true },
  });
  const needsRecentSignIn =
    Boolean(current && !canList) ||
    (sessions.error instanceof ApiError && sessions.error.status === 403 && sessions.error.code === 'SESSION_NOT_FRESH');
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
      title="Active sessions"
      actions={
        sessions.isSuccess && !needsRecentSignIn ? (
          <span className="text-xs tabular-nums text-muted-foreground">{sorted.length} signed in</span>
        ) : undefined
      }
    >
      {currentQuery.isPending ? (
        <TilesSkeleton count={2} label="Checking session access" />
      ) : currentQuery.isError ? (
        <ErrorState title="Couldn’t check your current session" onRetry={() => void currentQuery.refetch()} />
      ) : !current || needsRecentSignIn ? (
        <EmptyState
          icon={ShieldCheck}
          title="A quick security check"
          description="Sign in again to view and manage your devices. You’ll return here afterwards."
          action={{ label: 'Sign in again', href: '/sign-in?next=%2Fsettings%2Faccount&reason=recent-sign-in' }}
          className="px-0 py-8"
        />
      ) : sessions.isPending ? (
        <TilesSkeleton count={2} label="Loading active sessions" />
      ) : sessions.isError ? (
        <ErrorState title="Couldn’t load your active sessions" onRetry={() => void sessions.refetch()} />
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
                      isCurrent ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]' : 'border-border bg-background/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors duration-150',
                        isCurrent ? 'border-primary/40 bg-primary text-primary-foreground' : 'border-border bg-band text-muted-foreground',
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
