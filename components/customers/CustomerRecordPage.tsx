'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { CustomerAddresses } from '@/components/customers/CustomerAddresses';
import { CustomerBookings } from '@/components/customers/CustomerBookings';
import { CustomerFormDrawer } from '@/components/customers/CustomerForm';
import { CustomerLoyaltyCards, GrantRewardModal } from '@/components/customers/CustomerLoyaltyCards';
import { CustomerReferralCard } from '@/components/customers/CustomerReferralCard';
import { CustomerTimeline } from '@/components/customers/CustomerTimeline';
import { type ConsentState, CustomerWorkbench, useConsent } from '@/components/customers/CustomerWorkbench';
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
  ChevronRight,
  Clock,
  Coins,
  Combine,
  Gift,
  type IconComponent,
  Mail,
  Pencil,
  Receipt,
  Repeat,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserCircle2,
  Wallet,
} from '@/components/icons';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Bone, LoadingState } from '@/components/shared/Skeleton';
import { TONE_TINT } from '@/components/shared/tone';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import type { CustomerLoyaltyProgram } from '@/lib/api/loyalty.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { TIER_CONFIG } from '@/lib/constants/customers';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { getPrivacyRequests } from '@/lib/modules/compliance/client';
import { eraseCustomer, getCustomer, getCustomerLedger, getCustomerLoyaltyWallet, unmergeCustomer } from '@/lib/modules/customers/client';
import { getOrders } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { customerDisplayName } from '@/lib/utils/customer-card';
import { type Favourite, favouriteItems } from '@/lib/utils/customer-insights';
import { formatDate } from '@/lib/utils/date';
import { startOrderHref } from '@/lib/utils/start-order';
import { type VisitSummary, summariseVisits } from '@/lib/utils/visit-pattern';
import { formatInstant, workspaceDateKey } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import type { Customer } from '@/types/customers';

type Section = 'guest' | 'timeline' | 'compliance';

const SECTION_VALUES: Section[] = ['guest', 'timeline', 'compliance'];

const fmtDate = (iso: string) => formatDate(iso);

const VISIT_MONTHS = 6;

const WEEKDAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

/** Today as the business's calendar sees it — the workspace zone, not UTC or the browser. */
const localToday = (): string => workspaceDateKey();

const monthYear = (iso: string) => formatInstant(iso, { month: 'long', year: 'numeric' });

/**
 * A single customer.
 *
 * Laid out the way Square's and Shopify's customer pages are: what staff do
 * (start an order, email, edit) in the header; a wide column with the figures
 * that say what this guest is worth — one strip, then their loyalty, visits,
 * bookings and addresses; and a narrow column that is the same on every tab —
 * contact, notes, the card the till scans — so a note can be written while
 * reading the activity that prompted it.
 *
 * What must be known before serving them opens the Overview, above
 * everything; a compact marker rides in the masthead on the other tabs so an
 * allergy does not vanish while someone is reading the activity.
 */
export function CustomerRecordPage({ customerId }: { customerId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const qc = useQueryClient();
  const capabilities = useAuthStore((state) => state.capabilities);
  const money = useWorkspaceMoney();
  const [modal, setModal] = useState<'email' | 'points' | 'edit' | 'unmerge' | 'delete' | null>(null);
  const [granting, setGranting] = useState<CustomerLoyaltyProgram | null>(null);
  const [privacyPicked, setPrivacyOpen] = useState<'marketing' | 'requests' | null>(null);

  // The open tab lives in the URL: a colleague can be sent straight to the
  // compliance history, and the back button steps out of it the way it should.
  // What the workspace runs decides what this page asks for and shows: privacy
  // requests are Compliance's, marketing consent and email are Communications',
  // visits come from Orders. A disabled module's routes refuse even a capable
  // role, so nothing here asks a module that's off.
  const commsOn = useModuleEnabled('communications');
  const referralsOn = useModuleEnabled('referrals');
  const complianceOn = useModuleEnabled('compliance');
  const orderingOn = useModuleEnabled('ordering');
  const posOn = useModuleEnabled('pos');
  const reservationsOn = useModuleEnabled('reservations');
  const hasComplianceTab = commsOn || complianceOn;

  // ?privacy= opens a rail drawer from elsewhere — a consent row in the
  // activity, say. Closing the drawer clears the link.
  const privacyParam = searchParams.get('privacy');
  const linkedPrivacy =
    (privacyParam === 'marketing' && commsOn) || (privacyParam === 'requests' && complianceOn) ? privacyParam : null;
  const privacyOpen = privacyPicked ?? linkedPrivacy;
  const closePrivacy = () => {
    setPrivacyOpen(null);
    if (!privacyParam) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('privacy');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const requested = searchParams.get('tab');
  const asked: Section = SECTION_VALUES.includes(requested as Section) ? (requested as Section) : 'guest';
  // A link to a tab the workspace no longer has lands on Guest.
  // Privacy lives in the rail now, not a tab: an old ?tab=compliance link lands on the Overview.
  const section: Section = asked === 'compliance' ? 'guest' : asked;

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

  // Their orders feed the visit heatmap and the rail's
  // "Usually orders" — the rail is on every tab, so this is read on every tab.
  const visitsQuery = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-visits', customerId),
    queryFn: () => getOrders({ customerId, limit: 200 }),
    enabled: orderingOn,
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
    enabled: complianceOn && hasCapability(capabilities, 'privacy:read'),
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

  // Delete is the API's erasure: personal details wiped in place, the row kept so
  // order and payment history still adds up. Same routine as a privacy request.
  const remove = useMutation({
    mutationFn: () => eraseCustomer(customerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customerId) });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customers') });
      setModal(null);
      toast('success', 'Customer deleted.');
      router.push('/customers');
    },
    onError: (error) => toast('error', error.message || 'The customer wasn’t deleted.'),
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
  const orders = useMemo(() => visitsQuery.data?.data ?? [], [visitsQuery.data]);
  const favourites = useMemo(() => favouriteItems(orders), [orders]);

  // From the customer's own running totals, not from the fetched page of orders:
  // deriving it from a `limit: 200` fetch gave a heavy regular the average of
  // their most recent 200 orders, presented as a lifetime figure.
  const avgTicket = customer && customer.totalVisits > 0 ? Number(customer.totalSpent) / customer.totalVisits : 0;

  const canEdit = hasCapability(capabilities, 'customers:write');
  const canAdjustPoints = hasCapability(capabilities, 'customers:points');
  const canMerge = hasCapability(capabilities, 'customers:merge');
  const canDelete = hasCapability(capabilities, 'customers:erase');
  // Loyalty is on when the workspace runs at least one programme; with none, points and rewards don't apply.
  const loyaltyOn = (loyaltyWallet?.programmes.length ?? 0) > 0;
  // Issued automatically each birthday; this is the by-hand route, for a
  // birthday the guest mentions at the till, or one that fell before they joined.
  const birthdayProgrammes = (loyaltyWallet?.programmes ?? []).filter(
    (programme) => programme.earnRule.trigger === 'birthday' && (programme.earnRule.benefitMode ?? 'rewards') !== 'points',
  );
  const consent = useConsent(customer, commsOn);

  function handleSaved() {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customerId) });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customers') });
  }

  const name = customer ? customerDisplayName(customer) : isLoading ? 'Loading…' : 'Customer';
  const tier = customer ? TIER_CONFIG[customer.tier] : null;
  const erased = Boolean(customer?.anonymisedAt);
  // The Till when there is one, else New order on the Orders page with them picked; nothing if neither is theirs.
  const startOrder =
    customer && !erased
      ? startOrderHref(customer.id, { pos: posOn, manual: orderingOn && hasCapability(capabilities, 'orders:create') })
      : null;
  const hasAllergies = (customer?.allergies?.length ?? 0) > 0;
  const hasCriticalAlert = customer?.alerts?.some((alert) => alert.severity === 'critical') ?? false;

  const sections: SectionTab<Section>[] = [
    { value: 'guest', label: 'Overview', icon: UserCircle2 },
    { value: 'timeline', label: 'Activity', icon: Activity },
  ];

  return (
    <EditorShell
      eyebrow="Customer"
      title={name}
      onClose={() => router.push('/customers')}
      leading={customer ? <Avatar name={`${customer.firstName} ${customer.lastName}`} email={customer.email} /> : undefined}
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
          <div className="flex items-center gap-1.5 md:gap-2">
            {commsOn && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setModal('email')}
                disabled={!customer.email || consent === 'suppressed'}
                title={
                  !customer.email
                    ? 'Add an email address first'
                    : consent === 'suppressed'
                      ? 'This address is suppressed and can’t be emailed'
                      : undefined
                }
                aria-label="Send email"
              >
                <Send size={15} aria-hidden="true" />
                <span className="hidden md:inline">Send email</span>
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setModal('edit')} aria-label="Edit details">
                <Pencil size={15} aria-hidden="true" />
                <span className="hidden md:inline">Edit</span>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-exception hover:text-exception"
                onClick={() => setModal('delete')}
                aria-label="Delete customer"
              >
                <Trash2 size={15} aria-hidden="true" />
                <span className="hidden md:inline">Delete</span>
              </Button>
            )}
            {startOrder && (
              <Button
                size="sm"
                className="hidden gap-1.5 md:inline-flex"
                onClick={() => router.push(startOrder)}
                aria-label={posOn ? 'Start an order at the Till' : 'Start an order for this customer'}
              >
                <ShoppingBag size={15} aria-hidden="true" />
                Start an order
              </Button>
            )}
          </div>
        ) : undefined
      }
      subheader={
        customer ? (
          <>
            <div className="flex items-center gap-2 border-b border-border bg-field px-3 py-2 md:hidden">
              <Select
                value={section}
                onValueChange={(value) => setSection(value as Section)}
                options={sections.map(({ value, label }) => ({ value, label }))}
                ariaLabel="Customer section"
                className="min-w-0 flex-1"
              />
              {startOrder && (
                <Button size="sm" onClick={() => router.push(startOrder)}>
                  <ShoppingBag size={14} aria-hidden="true" />
                  Start an order
                </Button>
              )}
            </div>
            <div className="hidden md:block">
              <SectionTabs tabs={sections} value={section} onChange={setSection} ariaLabel="Customer record sections" />
            </div>
          </>
        ) : undefined
      }
    >
      {isLoading ? (
        <LoadingState label="Loading the customer" className="flex-1" />
      ) : isError || !customer ? (
        <div className="mx-auto max-w-md rounded-lg border border-border bg-field">
          {isError ? (
            <ErrorState
              title="This customer couldn’t be loaded"
              description="Check your connection and try again. If it keeps failing, the record may have been removed."
              onRetry={() => void refetch()}
            />
          ) : (
            <ErrorState icon={UserCircle2} title="Customer not found" description="It may have been removed, or the link is out of date." />
          )}
          <div className="flex justify-center border-t border-border px-5 py-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/customers')}>
              Back to customers
            </Button>
          </div>
        </div>
      ) : (
        // Keep notes and disclosures stable between tabs; reset for a different customer.
        <motion.div
          key={customer.id}
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
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
              {section === 'guest' ? (
                <>
                  <ValueStrip customer={customer} avgTicket={avgTicket} summary={visitSummary} money={money} />

                  {loyaltyOn && (
                    <SettingsSection
                      title="Loyalty"
                      actions={
                        canAdjustPoints && !erased ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            {birthdayProgrammes.map((programme) => (
                              <Button key={programme.id} variant="ghost" size="sm" onClick={() => setGranting(programme)}>
                                <Gift data-icon="inline-start" />
                                {birthdayProgrammes.length > 1 ? programme.name : 'Birthday reward'}
                              </Button>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => setModal('points')}>
                              <Coins data-icon="inline-start" />
                              Adjust points
                            </Button>
                          </div>
                        ) : undefined
                      }
                    >
                      <div className="space-y-5">
                        {/* The projection and the ledger disagreeing is a data-integrity
                            problem, not a cosmetic one, so it is stated rather than hidden. */}
                        {ledger && !ledger.reconciles && (
                          <RecordNotice icon={AlertTriangle} tone="warning" title="The points balance doesn’t match the ledger">
                            The balance shows {ledger.pointsBalance.toLocaleString()}; the loyalty ledger adds up to{' '}
                            {ledger.ledgerTotal.toLocaleString()}. Points were changed outside the ledger, or the opening backfill has not
                            been run.
                          </RecordNotice>
                        )}
                        <LoyaltyProgress customer={customer} />
                        <CustomerLoyaltyCards
                          customerId={customer.id}
                          customerName={`${customer.firstName} ${customer.lastName}`.trim()}
                          programmes={loyaltyWallet?.programmes ?? []}
                          canAdjust={canAdjustPoints && !erased}
                          canOrder={!erased}
                          framed={false}
                        />
                      </div>
                    </SettingsSection>
                  )}

                  {orderingOn && !visitsForbidden && (
                    <SettingsSection
                      title="Visit pattern"
                      description={
                        visitsQuery.isSuccess
                          ? `${visitSummary.visitDays.toLocaleString()} ${visitSummary.visitDays === 1 ? 'visit day' : 'visit days'} in the last ${VISIT_MONTHS} months · ${money(visitSummary.spend)} spent`
                          : `The last ${VISIT_MONTHS} months, one square a day.`
                      }
                      actions={
                        visitsQuery.isSuccess ? (
                          <span className="hidden sm:block">
                            <VisitLegend />
                          </span>
                        ) : undefined
                      }
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
                        <>
                          <VisitCalendar visits={visits} today={today} months={VISIT_MONTHS} money={money} />
                          <div className="mt-3 sm:hidden">
                            <VisitLegend />
                          </div>
                        </>
                      )}
                    </SettingsSection>
                  )}

                  {reservationsOn && !erased && hasCapability(capabilities, 'reservations:read') && (
                    <CustomerBookings customerId={customer.id} />
                  )}

                  {!erased && <CustomerAddresses customer={customer} canEdit={canEdit} />}
                </>
              ) : (
                <CustomerTimeline customerId={customer.id} />
              )}
            </div>
            <CustomerWorkbench
              customer={customer}
              canEdit={canEdit}
              // Consent is the Privacy section's first row now — said once.
              showConsent={false}
              insights={favourites.length > 0 ? <UsuallyOrders favourites={favourites} /> : undefined}
              privacy={
                hasComplianceTab ? (
                  <PrivacySection
                    consent={commsOn ? consent : null}
                    openRequests={complianceOn ? openPrivacy.length : null}
                    overdue={overduePrivacy}
                    onOpen={setPrivacyOpen}
                  />
                ) : undefined
              }
              referral={
                referralsOn && !erased ? (
                  <CustomerReferralCard
                    customerId={customer.id}
                    canIssue={canEdit}
                    canSetUp={hasCapability(capabilities, 'referrals:write')}
                  />
                ) : undefined
              }
              className="lg:col-start-2 lg:row-start-1"
            />
          </div>
        </motion.div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {modal === 'edit' && customer && <CustomerFormDrawer customer={customer} onClose={() => setModal(null)} onSaved={handleSaved} />}

      {modal === 'points' && customer && <PointsForm customer={customer} onClose={() => setModal(null)} onSaved={handleSaved} />}

      {modal === 'email' && customer?.email && (
        <SendEmailModal
          className="rounded-xl bg-field"
          customerId={customer.id}
          recipientName={`${customer.firstName} ${customer.lastName}`}
          recipientEmail={customer.email}
          onClose={() => setModal(null)}
        />
      )}

      {privacyOpen === 'marketing' && customer && (
        <Drawer icon={Mail} title="Marketing consent" onClose={closePrivacy}>
          <MarketingPreferencesPanel customerId={customer.id} email={customer.email} />
        </Drawer>
      )}
      {privacyOpen === 'requests' && customer && (
        <Drawer icon={ShieldCheck} title="Privacy requests" onClose={closePrivacy}>
          <PrivacyRequestsPanel customerId={customer.id} tenantId={customer.tenantId} chrome="drawer" />
        </Drawer>
      )}

      {granting && customer && (
        <GrantRewardModal
          customerId={customer.id}
          customerName={`${customer.firstName} ${customer.lastName}`.trim()}
          programme={granting}
          onClose={() => setGranting(null)}
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
      {modal === 'delete' && customer && (
        <ConfirmModal
          title={`Delete ${name}?`}
          message="Their name, contact details, birthday, notes, allergies and alerts are wiped for good. Their orders stay in your sales and reports, without a name attached. This can’t be undone."
          confirmLabel="Delete customer"
          pendingLabel="Deleting…"
          confirmText="delete"
          isPending={remove.isPending}
          onClose={() => setModal(null)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </EditorShell>
  );
}

// ── At a glance ──────────────────────────────────────────────────────────────

/**
 * What this guest is worth, as the Orders page shows its day: four `Fact`
 * tiles straight on the page. Lifetime figures come from the customer's own
 * running totals; the rhythm from their visits.
 */
function ValueStrip({
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
    <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Fact surface="page" icon={Wallet} label="Lifetime spend" value={money(customer.totalSpent)} />
      <Fact
        surface="page"
        icon={Repeat}
        label="Visits"
        value={customer.totalVisits.toLocaleString()}
        hint={customer.lastVisitAt ? `Last ${fmtDate(customer.lastVisitAt)}` : 'No visits yet'}
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

// ── Orders ───────────────────────────────────────────────────────────────────

/** What they usually have — what to offer, or to start making, when they walk in. */
function UsuallyOrders({ favourites }: { favourites: Favourite[] }) {
  return (
    <SettingsSection title="Usually orders">
      <ul className="space-y-2">
        {favourites.map((favourite) => (
          <li key={favourite.name} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-foreground">{favourite.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              ×{favourite.quantity.toLocaleString()} · {favourite.orders} {favourite.orders === 1 ? 'order' : 'orders'}
            </span>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}

// ── Privacy ──────────────────────────────────────────────────────────────────

const CONSENT_WORD: Record<ConsentState, string> = {
  opted_in: 'Opted in',
  opted_out: 'Opted out',
  suppressed: 'Suppressed',
  none: 'No email',
};

/**
 * Marketing consent and privacy requests as two rows at the foot of the rail —
 * they were a tab of their own. Each opens its full panel in a drawer, where
 * every change is still recorded with a source and a reason.
 */
function PrivacySection({
  consent,
  openRequests,
  overdue,
  onOpen,
}: {
  /** Null without Communications. */
  consent: ConsentState | null;
  /** Null without Compliance. */
  openRequests: number | null;
  overdue: boolean;
  onOpen: (panel: 'marketing' | 'requests') => void;
}) {
  // Contact's rows: a tinted tile, the value in bold, what it is beneath.
  return (
    <SettingsSection title="Privacy" bodyClassName="px-2 pt-2 pb-2">
      <ul>
        {consent && (
          <PrivacyRow
            icon={Mail}
            tile={
              consent === 'opted_in'
                ? 'bg-momentum/8 text-momentum'
                : consent === 'suppressed'
                  ? 'bg-exception/8 text-exception'
                  : 'bg-band text-muted-foreground'
            }
            value={CONSENT_WORD[consent]}
            label="Marketing consent"
            onClick={() => onOpen('marketing')}
          />
        )}
        {openRequests !== null && (
          <PrivacyRow
            icon={ShieldCheck}
            tile={
              overdue
                ? 'bg-exception/8 text-exception'
                : openRequests > 0
                  ? 'bg-measured/10 text-measured'
                  : 'bg-band text-muted-foreground'
            }
            value={openRequests > 0 ? `${openRequests} open${overdue ? ' · overdue' : ''}` : 'None open'}
            label="Privacy requests"
            onClick={() => onOpen('requests')}
          />
        )}
      </ul>
    </SettingsSection>
  );
}

function PrivacyRow({
  icon: Icon,
  tile,
  value,
  label,
  onClick,
}: {
  icon: IconComponent;
  tile: string;
  value: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', tile)}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{value}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{label}</span>
        </span>
        <ChevronRight
          size={14}
          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

// ── Notices ──────────────────────────────────────────────────────────────────

const NOTICE_TILE = {
  muted: TONE_TINT.muted,
  warning: TONE_TINT.warning,
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
        tone === 'warning' ? 'border-measured/35' : 'border-border',
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
