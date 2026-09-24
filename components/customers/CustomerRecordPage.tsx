'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { CustomerFormDrawer } from '@/components/customers/CustomerForm';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { CustomerWorkbench, type WorkbenchAction } from '@/components/customers/CustomerWorkbench';
import { GuestSafetyBlock } from '@/components/customers/GuestSafetyBlock';
import { LoyaltyProgress } from '@/components/customers/LoyaltyProgress';
import { MarketingPreferencesPanel } from '@/components/customers/MarketingPreferencesPanel';
import { PointsForm } from '@/components/customers/PointsForm';
import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import { VisitCalendar } from '@/components/customers/VisitCalendar';
import { SendEmailModal } from '@/components/email/SendEmailModal';
import {
  Activity,
  AlertTriangle,
  Coins,
  Combine,
  Loader2,
  Receipt,
  Repeat,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  UserCircle2,
  Wallet,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { TIER_CONFIG } from '@/lib/constants/customers';
import { getPrivacyRequests } from '@/lib/modules/compliance/client';
import { getCustomer, getCustomerLedger, unmergeCustomer } from '@/lib/modules/customers/client';
import { getOrders } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

type Section = 'guest' | 'timeline' | 'compliance';

const SECTION_VALUES: Section[] = ['guest', 'timeline', 'compliance'];

const fmtDate = (iso: string) => formatDate(iso);

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

/**
 * A single customer.
 *
 * The page is a dossier with a stable workbench beside it: the wide column
 * answers "what do I know about this guest", the narrow one answers "what can I
 * do about it", and the second column does not change when the tab does. That is
 * the Board-Then-Workbench rule applied to a record rather than a shift.
 *
 * Two things this fixes. Every action used to be an unlabelled icon square in
 * the top bar — an envelope, a pile of coins, a pencil — which staff had to
 * learn by trial. And writing one line about a guest meant opening the edit
 * drawer and saving the whole record; notes are now a box in the workbench that
 * saves itself.
 *
 * Allergies, alerts and preferences lead the Guest tab, which is the tab this
 * page opens on. A compact marker rides in the masthead so the fact does not
 * disappear entirely while someone is reading the timeline.
 */
export function CustomerRecordPage({ customerId }: { customerId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const capabilities = useAuthStore((state) => state.capabilities);
  const [modal, setModal] = useState<WorkbenchAction | 'unmerge' | null>(null);

  // The open tab lives in the URL: a colleague can be sent straight to the
  // compliance history, and the back button steps out of it the way it should.
  const requested = searchParams.get('tab');
  const section: Section = SECTION_VALUES.includes(requested as Section) ? (requested as Section) : 'guest';

  const setSection = useCallback(
    (next: Section) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'guest') params.delete('tab');
      else params.set('tab', next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const {
    data: customer,
    isLoading,
    isError,
  } = useQuery({ queryKey: moduleQueryKeys.customers.key('customer', customerId), queryFn: () => getCustomer(customerId) });

  // Only the visit heatmap needs order rows, and it lives on the Guest tab.
  const { data: ordersData } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-visits', customerId),
    queryFn: () => getOrders({ customerId, limit: 200 }),
    enabled: section === 'guest',
  });

  // The ledger is read here purely to surface a drift warning: if the cached
  // balance and the ledger disagree, points were written outside a transaction
  // and the number on screen cannot be trusted.
  const { data: ledger } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-ledger', customerId),
    queryFn: () => getCustomerLedger(customerId, 1),
    enabled: hasCapability(capabilities, 'customers:read'),
  });

  // Fetched for the tab badge, not for the panel — an outstanding erasure
  // request is exactly the thing you should not have to open a tab to discover.
  const { data: privacyRequests } = useQuery({
    queryKey: moduleQueryKeys.compliance.key('privacy-requests', undefined, customerId),
    queryFn: () => getPrivacyRequests({ customerId }),
  });

  const openPrivacy = useMemo(
    () => (privacyRequests ?? []).filter((request) => request.status !== 'completed' && request.status !== 'declined'),
    [privacyRequests],
  );
  // Pinned once on mount: "overdue" must not flip mid-render, and a live clock
  // buys nothing on a statutory deadline measured in days.
  const [now] = useState(() => Date.now());
  const overduePrivacy = openPrivacy.some((request) => Date.parse(request.dueAt) < now);

  const unmerge = useMutation({
    mutationFn: () => unmergeCustomer(customerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customerId) });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customers') });
      setModal(null);
      toast('success', 'Records separated.');
    },
    onError: (error) => toast('error', error.message || 'Could not separate these records.'),
  });

  const visits = (ordersData?.data ?? []).map((order) => ({ date: order.createdAt.slice(0, 10), spend: Number(order.totalAmount) }));

  // From the customer's own running totals, not from the fetched page of orders:
  // deriving it from a `limit: 200` fetch gave a heavy regular the average of
  // their most recent 200 orders, presented as a lifetime figure.
  const avgTicket = customer && customer.totalVisits > 0 ? Number(customer.totalSpent) / customer.totalVisits : 0;

  const canEdit = hasCapability(capabilities, 'customers:write');
  const canAdjustPoints = hasCapability(capabilities, 'customers:points');
  const canMerge = hasCapability(capabilities, 'customers:merge');

  function handleSaved() {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customerId) });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customers') });
  }

  const name = customer ? `${customer.firstName} ${customer.lastName}` : isLoading ? 'Loading…' : 'Customer';
  const tier = customer ? TIER_CONFIG[customer.tier] : null;
  const erased = Boolean(customer?.anonymisedAt);
  const hasAllergies = (customer?.allergies?.length ?? 0) > 0;
  const hasCriticalAlert = customer?.alerts?.some((alert) => alert.severity === 'critical') ?? false;

  const sections: SectionTab<Section>[] = [
    { value: 'guest', label: 'Guest', icon: UserCircle2 },
    { value: 'timeline', label: 'Timeline', icon: Activity },
    {
      value: 'compliance',
      label: 'Compliance',
      icon: ShieldCheck,
      count: openPrivacy.length,
      countTone: overduePrivacy ? 'danger' : 'default',
      countLabel: `${openPrivacy.length} open privacy request${openPrivacy.length === 1 ? '' : 's'}${overduePrivacy ? ', one or more overdue' : ''}`,
    },
  ];

  return (
    <EditorShell
      title={name}
      onClose={() => router.push('/customers')}
      leading={
        customer ? (
          <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} email={customer.email} className="size-9" />
        ) : undefined
      }
      meta={
        customer && tier ? (
          <>
            <Badge variant={tier.variant}>{tier.label}</Badge>
            {/* The safety block itself lives on the Guest tab. This marker rides
                in the masthead so the fact does not vanish when someone is two
                tabs deep in a timeline — one glyph, not a second copy. */}
            {(hasAllergies || hasCriticalAlert) && (
              <Badge variant="destructive" title={hasAllergies ? `Allergies: ${customer.allergies!.join(', ')}` : 'Has a critical alert'}>
                <AlertTriangle aria-hidden="true" />
                {hasAllergies ? 'Allergies' : 'Critical alert'}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {customer.lastVisitAt ? `Last visit ${fmtDate(customer.lastVisitAt)}` : 'No visits yet'} · guest since{' '}
              {monthYear(customer.createdAt)}
            </span>
          </>
        ) : undefined
      }
      actions={
        customer && !erased ? (
          <Button className="gap-1.5" onClick={() => router.push(`/pos?customer=${customer.id}`)} aria-label="Start an order in the POS">
            <ShoppingBag size={15} aria-hidden="true" />
            <span className="hidden md:inline">Start an order</span>
          </Button>
        ) : undefined
      }
      subheader={
        customer ? <SectionTabs tabs={sections} value={section} onChange={setSection} ariaLabel="Customer record sections" /> : undefined
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 size={22} className="animate-spin" aria-label="Loading customer" />
        </div>
      ) : isError || !customer ? (
        <div className="mx-auto max-w-md rounded-sm border border-rule bg-card p-8 text-center">
          <EmptyState icon={UserCircle2} title="Customer not found" description="It may have been removed, or the link is out of date." />
          <Button variant="outline" onClick={() => router.push('/customers')}>
            Back to customers
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Record-level state, before anything else ─────────────────── */}

          {customer.anonymisedAt && (
            <p className="flex items-start gap-2 rounded-sm border border-rule bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                This record was erased on {fmtDate(customer.anonymisedAt)} to fulfil a GDPR request. Order history is retained for financial
                reporting; the personal details are gone and cannot be restored.
              </span>
            </p>
          )}

          {customer.mergedIntoId && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/25 bg-warning/6 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-warning">
                <Combine size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  This record was merged into another on {customer.mergedAt ? fmtDate(customer.mergedAt) : 'an earlier date'}. It is hidden
                  from lists, and its history now shows on the surviving record.
                </span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push(`/customers/${customer.mergedIntoId}`)}>
                  Open surviving record
                </Button>
                {canMerge && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setModal('unmerge')}>
                    <RotateCcw size={14} aria-hidden="true" />
                    Separate
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Dossier ── workbench ──────────────────────────────────────── */}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            {/* Second in DOM below lg so the verbs sit above the analytics on a
                phone; ordered back to the right on a desk. */}
            <CustomerWorkbench
              customer={customer}
              canEdit={canEdit}
              canAdjustPoints={canAdjustPoints}
              onAction={setModal}
              className="lg:sticky lg:top-0 lg:col-start-2 lg:row-start-1"
            />

            <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
              {section === 'guest' ? (
                <>
                  {/* Allergies, alerts and preferences lead the Guest tab: it is
                      the tab this page opens on, so this is the first thing read. */}
                  <GuestSafetyBlock customer={customer} onEdit={canEdit && !erased ? () => setModal('edit') : undefined} />

                  <StatCardGrid columns={4}>
                    <StatCard
                      label="Total spent"
                      value={`£${Number(customer.totalSpent).toFixed(0)}`}
                      icon={Wallet}
                      accent="success"
                      size="sm"
                    />
                    <StatCard label="Visits" value={customer.totalVisits.toLocaleString()} icon={Repeat} accent="info" size="sm" />
                    <StatCard label="Average order" value={`£${avgTicket.toFixed(0)}`} icon={Receipt} accent="warning" size="sm" />
                    <StatCard label="Points" value={customer.pointsBalance.toLocaleString()} icon={Star} accent="purple" size="sm" />
                  </StatCardGrid>

                  {/* The projection and the ledger disagreeing is a data-integrity
                      problem, not a cosmetic one, so it is stated rather than hidden. */}
                  {ledger && !ledger.reconciles && (
                    <p className="flex items-start gap-2 rounded-sm border border-warning/25 bg-warning/6 px-4 py-2.5 text-xs text-warning">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>
                        The points balance ({ledger.pointsBalance.toLocaleString()}) does not match the loyalty ledger (
                        {ledger.ledgerTotal.toLocaleString()}). Points were changed outside the ledger, or the opening backfill has not been
                        run.
                      </span>
                    </p>
                  )}

                  {/* Loyalty and the visit heatmap are the same question asked
                      two ways — how engaged is this guest — so they share a row
                      once there is width for both to stay legible. */}
                  <div className={cn('grid gap-4', visits.length > 0 && 'xl:grid-cols-2')}>
                    <section className="flex flex-col rounded-sm border border-rule bg-card p-4 h-fit">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-foreground">Loyalty</h2>
                        <div className="flex items-center gap-2">
                          {tier && <Badge variant={tier.variant}>{tier.label}</Badge>}
                          {canAdjustPoints && !erased && (
                            <Button variant="ghost" size="xs" onClick={() => setModal('points')}>
                              <Coins data-icon="inline-start" />
                              Adjust
                            </Button>
                          )}
                        </div>
                      </div>
                      <LoyaltyProgress customer={customer} />
                    </section>

                    {visits.length > 0 && (
                      <section className="flex min-w-0 flex-col rounded-sm border border-rule bg-card p-4">
                        <h2 className="text-sm font-semibold text-foreground">Visit pattern</h2>
                        <div className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          <VisitCalendar visits={visits} months={6} />
                        </div>
                      </section>
                    )}
                  </div>
                </>
              ) : section === 'timeline' ? (
                <CustomerTimeline customerId={customer.id} />
              ) : (
                <div className="space-y-4">
                  <MarketingPreferencesPanel customerId={customer.id} email={customer.email} />
                  <PrivacyRequestsPanel customerId={customer.id} tenantId={customer.tenantId} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {modal === 'edit' && customer && <CustomerFormDrawer customer={customer} onClose={() => setModal(null)} onSaved={handleSaved} />}

      {modal === 'points' && customer && <PointsForm customer={customer} onClose={() => setModal(null)} onSaved={handleSaved} />}

      {modal === 'email' && customer?.email && (
        <SendEmailModal
          customerId={customer.id}
          recipientName={`${customer.firstName} ${customer.lastName}`}
          recipientEmail={customer.email}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'unmerge' && customer && (
        <ConfirmModal
          title="Separate these records?"
          message="This record becomes independent again. Points the merge moved are handed back, and both records’ totals are recalculated. Anything that happened after the merge stays where it happened."
          confirmLabel="Separate records"
          pendingLabel="Separating…"
          isPending={unmerge.isPending}
          onClose={() => setModal(null)}
          onConfirm={() => unmerge.mutate()}
        />
      )}
    </EditorShell>
  );
}
