'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Megaphone } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { type ProductUpdate, getUnreadUpdates, recordUpdate, updateKeys } from '@/lib/modules/identity/client';
import { useAuthStore } from '@/stores/authStore';
import { useLoginIntroStore } from '@/stores/loginIntroStore';

/** Popups are restricted to the dashboard; every operational route stays quiet. */
export function UpdateNotifier() {
  const userId = useAuthStore((state) => state.user?.id);
  return userId ? <UserUpdateNotifier key={userId} /> : null;
}
function UserUpdateNotifier() {
  const userId = useAuthStore((state) => state.user?.id);
  const intro = useLoginIntroStore((state) => state.pending);
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [popup, setPopup] = useState<ProductUpdate | null>(null);
  const attempted = useRef(false);
  const unread = useQuery({
    queryKey: updateKeys.unread(userId),
    queryFn: getUnreadUpdates,
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });
  useEffect(() => {
    attempted.current = false;
  }, [userId]);
  useEffect(() => {
    if (!userId || intro || pathname !== '/dashboard' || !unread.data?.popup || attempted.current) return;
    const candidate = unread.data.popup;
    const sessionKey = `duma-update-session:${userId}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
    } catch {
      /* Browser storage is optional; server receipts remain authoritative. */
    }
    let disposed = false;
    const timer = window.setInterval(async () => {
      if (
        disposed ||
        document.visibilityState !== 'visible' ||
        document.querySelector('[role="dialog"], [role="alertdialog"]') ||
        attempted.current
      )
        return;
      attempted.current = true;
      window.clearInterval(timer);
      try {
        const result = await recordUpdate(candidate.id, candidate.announcement, 'shown');
        if (result.claimed) {
          try {
            sessionStorage.setItem(sessionKey, 'shown');
          } catch {
            /* Per-user receipts still prevent repeat display. */
          }
          if (!disposed) setPopup(candidate);
        }
      } catch {
        /* An unavailable announcement must never block using DUMA. */
      }
    }, 3500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [userId, intro, pathname, unread.data?.popup]);
  const dismiss = () => {
    if (!popup) return;
    void recordUpdate(popup.id, popup.announcement, 'dismiss').catch(() => {});
    setPopup(null);
    void qc.invalidateQueries({ queryKey: updateKeys.unread(userId) });
  };
  return (
    <>
      <Link
        href="/updates"
        aria-label={unread.data?.count ? `What's new, ${unread.data.count} unread updates` : "What's new"}
        title={unread.isError ? 'What’s new — unable to check for new updates' : 'What’s new'}
        className="relative flex size-9 items-center justify-center rounded-md transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Megaphone size={18} aria-hidden="true" />
        {!!unread.data?.count && <span aria-hidden="true" className="absolute right-1 top-1 size-2 rounded-full bg-primary" />}
      </Link>
      {popup && pathname === '/dashboard' && (
        <Modal
          title="What’s new in DUMA"
          onClose={dismiss}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={dismiss}>
                Dismiss
              </Button>
              <Button
                onClick={() => {
                  const id = popup.id;
                  dismiss();
                  router.push(`/updates/${id}`);
                }}
              >
                Read update
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">{popup.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{popup.summary}</p>
          </div>
        </Modal>
      )}
    </>
  );
}
