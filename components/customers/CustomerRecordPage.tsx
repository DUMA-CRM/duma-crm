'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { CustomerFormDrawer } from '@/components/customers/CustomerForm';
import { CustomerLoyaltyCards } from '@/components/customers/CustomerLoyaltyCards';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { CustomerWorkbench, type WorkbenchAction } from '@/components/customers/CustomerWorkbench';
import { GuestSafetyBlock } from '@/components/customers/GuestSafetyBlock';
import { LoyaltyProgress } from '@/components/customers/LoyaltyProgress';
import { MarketingPreferencesPanel } from '@/components/customers/MarketingPreferencesPanel';
import { PointsForm } from '@/components/customers/PointsForm';
import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import { VisitCalendar, VisitLegend } from '@/components/customers/VisitCalendar';
import { SendEmailModal } from '@/components/email/SendEmailModal';
import {
  Activity,
  AlertTriangle,
  Clock,
  Combine,
  Receipt,
  Repeat,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  UserCircle2,
  Wallet,
} from '@/components/icons';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Bone, LoadingState } from '@/components/shared/Skeleton';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import { TIER_CONFIG } from '@/lib/constants/customers';
import { getPrivacyRequests } from '@/lib/modules/compliance/client';
import { getCustomer, getCustomerLedger, getCustomerLoyaltyWallet, unmergeCustomer } from '@/lib/modules/customers/client';
import { getOrders } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { type VisitSummary, summariseVisits } from '@/lib/utils/visit-pattern';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import type { Customer } from '@/types/customers';

type Section = 'guest' | 'timeline' | 'compliance';

const SECTION_VALUES: Section[] = ['guest', 'timeline', 'compliance'];

const fmtDate = (iso: string) => formatDate(iso);

const VISIT_MONTHS = 6;

const WEEKDAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

/** Today as the guest's calendar sees it — local, not UTC. */
function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/**
 * A single customer.
 *
 * Laid out as a settings tab is — the same body, panels, fact tiles and rows —
 * so a guest's record, a staff member's record and your own Profile read as one
 * product. The main column answers "what do I know about this guest"; the
 * narrow one beside it answers "what can I do about it", and it is the same
 * column on every tab, so a note can be written while reading the timeline
 * that prompted it.
 *
 * The Guest tab, which the page opens on, leads with who this is and four
 * facts, then what must be known before serving them. A compact marker rides
 * in the masthead so an allergy does not vanish while someone is reading the
 * timeline.
 */
export function CustomerRecordPage({ customerId }: { customerId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const qc = useQueryClient();
  const capabilities = useAuthStore((state) => state.capabilities);
  const money = useWorkspaceMoney();
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
    refetch,
  } = useQuery({ queryKey: moduleQueryKeys.customers.key('customer', customerId), queryFn: () => getCustomer(customerId) });

  // Only the Guest tab needs order rows: the visit heatmap and its rhythm.
  const visitsQuery = useQuery({
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
  const { data: loyaltyWallet } = useQuery({
    queryKey: moduleQueryKeys.customers.key('loyalty-wallet', customerId),
    // Every tab: the Actions panel beside each one offers the birthday reward.
    queryFn: () => getCustomerLoyaltyWallet(customerId),
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

  // `GET /orders` checks a capability some customer roles lack (see the
  // `orders:bulk` note in CLAUDE.md). A refusal is not a failure to retry, so
  // the panel steps aside instead of offering a "Try again" that cannot work.
  const visitsForbidden = visitsQuery.error instanceof ApiError && visitsQuery.error.status === 403;
  const visits = useMemo(
    () => (visitsQuery.data?.data ?? []).map((order) => ({ date: order.createdAt.slice(0, 10), spend: Number(order.totalAmount) })),
    [visitsQuery.data],
  );
  // Pinned per mount, like `now` below, so the grid and its facts agree.
  const [today] = useState(localToday);
  const visitSummary = useMemo(() => summariseVisits(visits, today, VISIT_MONTHS), [visits, today]);

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
      eyebrow="Customer"
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
            <span className="hidden text-xs text-muted-foreground sm:inline">Guest since {monthYear(customer.createdAt)}</span>
            {/* The safety block itself opens the Guest tab. This marker rides in
                the masthead only on the other tabs, so the fact does not vanish
                two tabs deep in a timeline — and is not said twice on the first. */}
            {section !== 'guest' && (hasAllergies || hasCriticalAlert) && (
              <Badge variant="destructive" title={hasAllergies ? `Allergies: ${customer.allergies!.join(', ')}` : 'Has a critical alert'}>
                <AlertTriangle aria-hidden="true" />
                {hasAllergies ? 'Allergies' : 'Critical alert'}
              </Badge>
            )}
          </>
        ) : undefined
      }
      actions={
        customer && !erased ? (
          <Button
            className="h-9 gap-1.5"
            onClick={() => router.push(`/pos?customer=${customer.id}`)}
            aria-label="Start an order in the POS"
          >
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
        <LoadingState label="Loading the customer" className="py-24" />
      ) : isError || !customer ? (
        <div className="mx-auto max-w-md rounded-lg border border-rule/60 bg-field">
          {isError ? (
            <ErrorState
              title="This customer couldn’t be loaded"
              description="Check your connection and try again. If it keeps failing, the record may have been removed."
              onRetry={() => void refetch()}
            />
          ) : (
            <ErrorState icon={UserCircle2} title="Customer not found" description="It may have been removed, or the link is out of date." />
          )}
          <div className="flex justify-center border-t border-rule/45 px-5 py-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/customers')}>
              Back to customers
            </Button>
          </div>
        </div>
      ) : (
        // Keyed by tab so only the body re-enters on a switch — the shell's
        // stagger, the same as the settings tabs.
        <motion.div
          key={section}
          className="space-y-5"
          initial={reduceMotion ? false : 'hidden'}
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
        >
          {/* ── Record-level state, before anything else ─────────────────── */}

          {customer.anonymisedAt && (
            <RecordNotice icon={ShieldCheck} tone="muted" title={`Erased on ${fmtDate(customer.anonymisedAt)}`}>
              The personal details were removed to fulfil a GDPR request and cannot be restored. Order history is retained for financial
              reporting.
            </RecordNotice>
          )}

          {customer.mergedIntoId && (
            <RecordNotice
              icon={Combine}
              tone="warning"
              title={`Merged into another record${customer.mergedAt ? ` on ${fmtDate(customer.mergedAt)}` : ''}`}
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/customers/${customer.mergedIntoId}`)}>
                    Open surviving record
                  </Button>
                  {canMerge && (
                    <Button variant="outline" size="sm" onClick={() => setModal('unmerge')}>
                      <RotateCcw data-icon="inline-start" />
                      Separate
                    </Button>
                  )}
                </>
              }
            >
              It is hidden from lists, and its history now shows on the surviving record.
            </RecordNotice>
          )}

          {/* Allergies, alerts and preferences open the Guest tab, across the
              full width and above everything else: it is the tab this page
              opens on, so this is the first thing read before serving. */}
          {section === 'guest' && <GuestSafetyBlock customer={customer} />}

          {/* ── Dossier ── workbench ──────────────────────────────────────
              The settings body's grid with its narrow rail. The rail comes
              first in the DOM so that on a phone the verbs sit above the
              analytics; on a desk it is placed back on the right. */}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
            <CustomerWorkbench
              customer={customer}
              loyaltyProgrammes={loyaltyWallet?.programmes ?? []}
              canEdit={canEdit}
              showConsent={section !== 'compliance'}
              canAdjustPoints={canAdjustPoints}
              onAction={setModal}
              className="lg:col-start-2 lg:row-start-1"
            />

            <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
              {section === 'guest' ? (
                <>
                  <GlanceFacts customer={customer} avgTicket={avgTicket} summary={visitSummary} money={money} />

                  {/* The projection and the ledger disagreeing is a data-integrity
                      problem, not a cosmetic one, so it is stated rather than hidden. */}
                  {ledger && !ledger.reconciles && (
                    <RecordNotice icon={AlertTriangle} tone="warning" title="The points balance doesn’t match the ledger">
                      The balance shows {ledger.pointsBalance.toLocaleString()}; the loyalty ledger adds up to{' '}
                      {ledger.ledgerTotal.toLocaleString()}. Points were changed outside the ledger, or the opening backfill has not been
                      run.
                    </RecordNotice>
                  )}

                  <SettingsSection title="Points">
                    <LoyaltyProgress customer={customer} />
                  </SettingsSection>

                  <CustomerLoyaltyCards
                    customerId={customer.id}
                    customerName={`${customer.firstName} ${customer.lastName}`.trim()}
                    programmes={loyaltyWallet?.programmes ?? []}
                    canAdjust={canAdjustPoints && !erased}
                    canOrder={!erased}
                  />

                  {!visitsForbidden && (
                    <SettingsSection
                      title="Visit pattern"
                      description={
                        visitsQuery.isSuccess
                          ? `${visitSummary.visitDays.toLocaleString()} ${visitSummary.visitDays === 1 ? 'visit day' : 'visit days'} in the last ${VISIT_MONTHS} months · ${money(visitSummary.spend)} spent`
                          : `The last ${VISIT_MONTHS} months, one square a day.`
                      }
                      actions={visitsQuery.isSuccess ? <VisitLegend /> : undefined}
                      footnote={visitsQuery.isSuccess && visits.length >= 200 ? 'Drawn from their most recent 200 orders.' : undefined}
                    >
                      {visitsQuery.isPending ? (
                        <div role="status" aria-busy="true" aria-label="Loading visits">
                          <Bone className="h-40 rounded-lg" />
                        </div>
                      ) : visitsQuery.isError ? (
                        <ErrorState
                          className="py-8"
                          title="Visits couldn’t be loaded"
                          description="The rest of the record is unaffected."
                          onRetry={() => void visitsQuery.refetch()}
                        />
                      ) : (
                        <VisitCalendar visits={visits} today={today} months={VISIT_MONTHS} money={money} />
                      )}
                    </SettingsSection>
                  )}
                </>
              ) : section === 'timeline' ? (
                <CustomerTimeline customerId={customer.id} />
              ) : (
                // Two blocks headed on the page, as the staff record lays them
                // out: more air between them than between panels.
                <div className="space-y-8">
                  <MarketingPreferencesPanel customerId={customer.id} email={customer.email} />
                  <PrivacyRequestsPanel customerId={customer.id} tenantId={customer.tenantId} />
                </div>
              )}
            </div>
          </div>
        </motion.div>
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

// ── At a glance ──────────────────────────────────────────────────────────────

/**
 * Four facts, straight on the page — the header already says who this is, and
 * the Contact panel how to reach them, so nothing here repeats either. Lifetime
 * figures come from the customer's own running totals; the rhythm comes from
 * the visit pattern below.
 */
function GlanceFacts({
  customer,
  avgTicket,
  summary,
  money,
}: {
  customer: Customer;
  avgTicket: number;
  summary: VisitSummary;
  money: (amount: string | number | null | undefined) => string;
}) {
  return (
    <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      <Fact surface="page" icon={Wallet} label="Lifetime spend" value={money(customer.totalSpent)} />
      <Fact
        surface="page"
        icon={Repeat}
        label="Visits"
        value={customer.totalVisits.toLocaleString()}
        hint={customer.lastVisitAt ? `Last visit ${fmtDate(customer.lastVisitAt)}` : 'No visits yet'}
      />
      <Fact surface="page" icon={Receipt} label="Average order" value={customer.totalVisits > 0 ? money(avgTicket) : '—'} />
      <Fact
        surface="page"
        icon={Clock}
        label="Comes back"
        value={summary.averageGapDays === null ? '—' : summary.averageGapDays <= 1 ? 'Daily' : `Every ${summary.averageGapDays} days`}
        hint={
          summary.busiestWeekday !== null
            ? `Usually ${WEEKDAYS[summary.busiestWeekday]}`
            : summary.averageGapDays === null
              ? 'Needs two visits'
              : undefined
        }
      />
    </motion.dl>
  );
}

// ── Notices ──────────────────────────────────────────────────────────────────

const NOTICE_TILE = {
  muted: 'bg-band text-muted-foreground',
  warning: 'bg-measured/10 text-measured',
} as const;

/** A record-level fact as one row on the page — the staff record's "needs you" strip. */
function RecordNotice({
  icon: Icon,
  tone,
  title,
  actions,
  children,
}: {
  icon: typeof AlertTriangle;
  tone: keyof typeof NOTICE_TILE;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={SECTION_RISE}
      role={tone === 'warning' ? 'alert' : undefined}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border bg-field px-4 py-3',
        tone === 'warning' ? 'border-measured/35' : 'border-rule/60',
      )}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', NOTICE_TILE[tone])}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 basis-60">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{children}</span>
      </span>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}
