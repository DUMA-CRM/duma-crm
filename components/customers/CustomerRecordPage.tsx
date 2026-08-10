'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import QRCode from 'react-qr-code';

import { CustomerEmails } from '@/components/customers/CustomerEmails';
import { CustomerOrders } from '@/components/customers/CustomerOrders';
import { EditForm } from '@/components/customers/EditForm';
import { LoyaltyProgress } from '@/components/customers/LoyaltyProgress';
import { MarketingPreferencesPanel } from '@/components/customers/MarketingPreferencesPanel';
import { PointsForm } from '@/components/customers/PointsForm';
import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import { VisitCalendar } from '@/components/customers/VisitCalendar';
import { SendEmailModal } from '@/components/email/SendEmailModal';
import {
  Activity,
  Calendar,
  Check,
  Coins,
  FileText,
  LayoutDashboard,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Star,
  UserCircle2,
  Wallet,
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Modal } from '@/components/shared/Modal';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getCustomer } from '@/lib/api/customers.service';
import { getOrders } from '@/lib/api/orders.service';
import { TIER_CONFIG } from '@/lib/constants/customers';
import { customerQrValue } from '@/lib/utils/customer-qr';
import { formatDate } from '@/lib/utils/date';

type Section = 'overview' | 'activity' | 'emails' | 'privacy';

const SECTIONS: SectionTab<Section>[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'activity', label: 'Visits & orders', icon: Activity },
  { value: 'emails', label: 'Emails', icon: Mail },
  { value: 'privacy', label: 'Privacy & consent', icon: ShieldCheck },
];

const fmtDate = (iso: string) => formatDate(iso);

export function CustomerRecordPage({ customerId }: { customerId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>('overview');
  const [modal, setModal] = useState<'edit' | 'points' | 'email' | null>(null);

  const { data: customer, isLoading, isError } = useQuery({ queryKey: ['customer', customerId], queryFn: () => getCustomer(customerId) });

  const { data: ordersData } = useQuery({
    queryKey: ['customer-visits', customerId],
    queryFn: () => getOrders({ customerId, limit: 200 }),
  });

  const visits = (ordersData?.data ?? []).map((order) => ({ date: order.createdAt.slice(0, 10), spend: Number(order.totalAmount) }));
  const avgTicket = visits.length > 0 ? visits.reduce((sum, visit) => sum + visit.spend, 0) / visits.length : 0;

  function handleSaved() {
    void qc.invalidateQueries({ queryKey: ['customer', customerId] });
    void qc.invalidateQueries({ queryKey: ['customers'] });
  }

  const name = customer ? `${customer.firstName} ${customer.lastName}` : isLoading ? 'Loading…' : 'Customer';
  const tier = customer ? TIER_CONFIG[customer.tier] : null;

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
            <span className="text-xs text-muted-foreground">
              {customer.lastVisitAt ? `Last visit ${fmtDate(customer.lastVisitAt)}` : 'No visits yet'}
            </span>
          </>
        ) : undefined
      }
      actions={
        customer && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => setModal('email')}
              aria-label="Send email"
              disabled={!customer.email}
              title={customer.email ? 'Send email' : 'Add an email address first'}
            >
              <Mail size={16} />
            </Button>
            <Button variant="outline" size="icon" className="size-9" onClick={() => setModal('points')} aria-label="Adjust points">
              <Coins size={16} />
            </Button>
            <Button variant="outline" size="icon" className="size-9" onClick={() => setModal('edit')} aria-label="Edit customer">
              <Pencil size={16} />
            </Button>
            <Button className="h-9 gap-1.5" onClick={() => router.push(`/pos?customer=${customer.id}`)}>
              <ShoppingBag size={15} />
              <span className="hidden md:inline">Open in POS</span>
            </Button>
          </>
        )
      }
      subheader={
        customer ? <SectionTabs tabs={SECTIONS} value={section} onChange={setSection} ariaLabel="Customer record sections" /> : undefined
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : isError || !customer ? (
        <div className="mx-auto max-w-md rounded-lg border border-rule/65 bg-card p-8 text-center">
          <EmptyState icon={UserCircle2} title="Customer not found" description="It may have been removed, or the link is out of date." />
          <Button variant="outline" onClick={() => router.push('/customers')}>
            Back to customers
          </Button>
        </div>
      ) : section === 'overview' ? (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-rule/65 bg-card" aria-label="Customer relationship summary">
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Total spent', value: `£${Number(customer.totalSpent).toFixed(0)}`, icon: Wallet, tone: 'text-momentum' },
                { label: 'Visits', value: customer.totalVisits.toLocaleString(), icon: Repeat, tone: 'text-reference' },
                { label: 'Average order', value: `£${avgTicket.toFixed(0)}`, icon: Receipt, tone: 'text-measured' },
                { label: 'Points', value: customer.pointsBalance.toLocaleString(), icon: Star, tone: 'text-stock' },
              ].map(({ label, value, icon: Icon, tone }, index) => (
                <div
                  key={label}
                  className={`flex min-h-24 items-center gap-3 p-4 sm:p-5 ${index % 2 ? 'border-l border-rule/45' : ''} ${index > 1 ? 'border-t border-rule/45 lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l lg:border-rule/45' : ''}`}
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-md bg-band ${tone}`}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p data-figure className="mt-0.5 truncate text-lg font-semibold text-foreground">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* Loyalty and the QR that identifies this customer at the till */}
            <section className="rounded-lg border border-rule/65 bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-foreground">Loyalty</h2>
                {tier && <Badge variant={tier.variant}>{tier.label}</Badge>}
              </div>
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                <LoyaltyProgress customer={customer} />
                <div className="flex flex-col items-center gap-2">
                  {/* Always on white so it scans in dark mode too */}
                  <div className="rounded-md border border-rule/65 bg-white p-2.5">
                    <QRCode
                      value={customerQrValue(customer.id)}
                      size={104}
                      bgColor="#ffffff"
                      fgColor="#111a40"
                      aria-label="Customer loyalty QR code"
                    />
                  </div>
                  <p className="font-mono text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                    {customer.id.slice(0, 8)}
                  </p>
                  <p className="max-w-32 text-center text-micro leading-tight text-muted-foreground/70">Scan at the till to attach</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-rule/65 bg-card p-5">
              <h2 className="mb-4 font-semibold text-foreground">Contact</h2>
              <InfoGroup>
                <InfoRow icon={Phone} label="Phone" value={customer.phone} copyable />
                {customer.email && <InfoRow icon={Mail} label="Email" value={customer.email} copyable />}
                {customer.dob && <InfoRow icon={Calendar} label="Date of birth" value={fmtDate(customer.dob)} />}
                {customer.lastVisitAt && <InfoRow icon={Check} label="Last visit" value={fmtDate(customer.lastVisitAt)} />}
                <InfoRow icon={Star} label="Points balance" value={`${customer.pointsBalance.toLocaleString()} pts`} />
                <InfoRow icon={ShoppingBag} label="Total orders" value={String(ordersData?.total ?? customer.totalVisits)} />
              </InfoGroup>
              {customer.notes && (
                <div className="mt-3">
                  <InfoGroup>
                    <InfoRow icon={FileText} label="Notes" value={customer.notes} />
                  </InfoGroup>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : section === 'activity' ? (
        <div className="space-y-4">
          {visits.length > 0 && (
            <section className="rounded-lg border border-rule/65 bg-card p-5">
              <h2 className="mb-4 font-semibold text-foreground">Visit pattern</h2>
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <VisitCalendar visits={visits} months={6} />
              </div>
            </section>
          )}
          <CustomerOrders customerId={customer.id} />
        </div>
      ) : section === 'emails' ? (
        <CustomerEmails customerId={customer.id} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <MarketingPreferencesPanel customerId={customer.id} hasEmail={Boolean(customer.email)} />
          <PrivacyRequestsPanel customerId={customer.id} tenantId={customer.tenantId} />
        </div>
      )}

      {/* Modals */}
      {modal === 'edit' && customer && (
        <Modal title="Edit Customer" onClose={() => setModal(null)}>
          <EditForm customer={customer} onClose={() => setModal(null)} onSaved={handleSaved} />
        </Modal>
      )}
      {modal === 'points' && customer && (
        <Modal title="Adjust Points" onClose={() => setModal(null)}>
          <PointsForm customer={customer} onClose={() => setModal(null)} onSaved={handleSaved} />
        </Modal>
      )}
      {modal === 'email' && customer?.email && (
        <SendEmailModal
          customerId={customer.id}
          recipientLabel={`${customer.firstName} ${customer.lastName} · ${customer.email}`}
          onClose={() => setModal(null)}
        />
      )}
    </EditorShell>
  );
}
