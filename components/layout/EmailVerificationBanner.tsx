'use client';

import { useMutation } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import { Mail, X } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { sendVerificationEmail } from '@/lib/modules/identity/client';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

// Full-screen surfaces: a till or kitchen screen is not where anyone confirms
// an email, and the strip would cost them a row of touch targets.
const HIDDEN_ON = ['/pos', '/kds'];
const DISMISSED_KEY = 'duma.email-verification-banner.dismissed';
const noSubscription = () => () => {};

/**
 * Soft email verification: an unverified account can use DUMA as normal; this
 * strip asks it to confirm and offers a resend. Dismissal lasts for the tab.
 */
export function EmailVerificationBanner() {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  // sessionStorage does not exist on the server; the server snapshot keeps the
  // first client render in agreement with it.
  const dismissedEarlier = useSyncExternalStore(
    noSubscription,
    () => sessionStorage.getItem(DISMISSED_KEY) === '1',
    () => false,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = dismissedEarlier || dismissedNow;

  const resend = useMutation({
    mutationFn: () => sendVerificationEmail(user!.email, `${window.location.origin}/verify-email`),
    onSuccess: () => toast('success', `Confirmation link sent to ${user!.email}.`),
    onError: () => toast('error', 'The confirmation email wasn’t sent. Try again in a minute.'),
  });

  if (!user || user.emailVerified || dismissed) return null;
  if (HIDDEN_ON.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  return (
    <div role="status" className="flex items-center gap-3 border-b border-rule bg-band px-4 py-2 text-sm md:px-8">
      <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1">
        Confirm your email <span className="font-semibold">{user.email}</span> so we can help you if you’re ever locked out.
      </p>
      <Button variant="outline" size="sm" disabled={resend.isPending || resend.isSuccess} onClick={() => resend.mutate()}>
        {resend.isPending ? 'Sending…' : resend.isSuccess ? 'Sent' : 'Resend email'}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Hide for now"
        onClick={() => {
          sessionStorage.setItem(DISMISSED_KEY, '1');
          setDismissedNow(true);
        }}
      >
        <X />
      </Button>
    </div>
  );
}
