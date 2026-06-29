'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, Coins, FileText, Mail, Pencil, Phone, ShoppingBag, Star, UserCircle2 } from 'lucide-react';
import { useState } from 'react';

import { CustomerOrders } from '@/components/customers/CustomerOrders';
import { EditForm } from '@/components/customers/EditForm';
import { LoyaltyProgress } from '@/components/customers/LoyaltyProgress';
import { PointsForm } from '@/components/customers/PointsForm';
import { VisitCalendar } from '@/components/customers/VisitCalendar';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

import { getOrders } from '@/lib/api/orders.service';
import { TIER_CONFIG } from '@/lib/constants/customers';
import type { Customer } from '@/types/customers';

interface CustomerPanelProps {
  customer: Customer | null;
  onCustomerUpdate?: (c: Customer) => void;
}

export function CustomerPanel({ customer, onCustomerUpdate }: CustomerPanelProps) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'edit' | 'points' | null>(null);

  const { data: ordersData } = useQuery({
    queryKey: ['customer-visits', customer?.id],
    queryFn: () => getOrders({ customerId: customer!.id, limit: 200 }),
    enabled: !!customer,
  });

  const visits = (ordersData?.data ?? []).map((o) => ({
    date: o.createdAt.slice(0, 10),
    spend: Number(o.totalAmount),
  }));

  const avgTicket =
    visits.length > 0 ? visits.reduce((s, v) => s + v.spend, 0) / visits.length : 0;

  function handleSaved(updated: Customer) {
    qc.invalidateQueries({ queryKey: ['customers'] });
    onCustomerUpdate?.(updated);
  }

  const tier = customer ? TIER_CONFIG[customer.tier] : null;

  return (
    <div className="w-100 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden h-full">
      {!customer ? (
        <EmptyState icon={UserCircle2} title="No customer selected" description="Select a customer from the list to view their profile" />
      ) : (
        <>
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col">
              {/* Top bar */}
              <div className="flex items-center justify-end gap-2 px-5 pt-5 pb-2">
                <Button variant="outline" size="icon" onClick={() => setModal('points')} aria-label="Adjust points">
                  <Coins size={16} />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setModal('edit')} aria-label="Edit customer">
                  <Pencil size={16} />
                </Button>
              </div>

              {/* Avatar + name */}
              <div className="flex flex-col items-center px-6 pt-2 pb-5 text-center">
                <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} size="lg" className="mb-4" />
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-foreground leading-tight">
                    {customer.firstName} {customer.lastName}
                  </h2>
                  {tier && <Badge variant={tier.variant}>{tier.label}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Member since {new Date(customer.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="px-5 flex flex-col gap-4 pb-6">
                {/* KPI row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-background rounded-xl border border-border px-3 py-2.5 text-center">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      £{Number(customer.totalSpent).toFixed(0)}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Spent</p>
                  </div>
                  <div className="bg-background rounded-xl border border-border px-3 py-2.5 text-center">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {customer.totalVisits}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Visits</p>
                  </div>
                  <div className="bg-background rounded-xl border border-border px-3 py-2.5 text-center">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      £{avgTicket.toFixed(0)}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Avg Order</p>
                  </div>
                </div>

                {/* Loyalty progress */}
                <LoyaltyProgress customer={customer} />

                {/* Visit calendar */}
                {visits.length > 0 && (
                  <div className="bg-background rounded-2xl max-w-90 border border-border p-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <VisitCalendar visits={visits} months={4} />
                  </div>
                )}

                {/* Contact details */}
                <div>
                  <Label className="mb-2">CONTACT</Label>
                  <InfoGroup>
                    <InfoRow icon={Phone} label="Phone" value={customer.phone} copyable />
                    {customer.email && <InfoRow icon={Mail} label="Email" value={customer.email} copyable />}
                    {customer.dob && (
                      <InfoRow
                        icon={Calendar}
                        label="Date of birth"
                        value={new Date(customer.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      />
                    )}
                    {customer.lastVisitAt && (
                      <InfoRow
                        icon={Check}
                        label="Last visit"
                        value={new Date(customer.lastVisitAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      />
                    )}
                  </InfoGroup>
                </div>

                {/* Notes */}
                {customer.notes && (
                  <InfoGroup>
                    <InfoRow icon={FileText} label="Notes" value={customer.notes} />
                  </InfoGroup>
                )}

                {/* Extra stats */}
                <InfoGroup>
                  <InfoRow icon={Star} label="Points balance" value={`${customer.pointsBalance.toLocaleString()} pts`} />
                  <InfoRow icon={ShoppingBag} label="Total orders" value={String(ordersData?.total ?? customer.totalVisits)} />
                </InfoGroup>

                {/* Orders */}
                <CustomerOrders customerId={customer.id} />
              </div>
            </div>
          </ScrollArea>

          {/* Modals */}
          {modal === 'edit' && (
            <Modal title="Edit Customer" onClose={() => setModal(null)}>
              <EditForm customer={customer} onClose={() => setModal(null)} onSaved={handleSaved} />
            </Modal>
          )}
          {modal === 'points' && (
            <Modal title="Adjust Points" onClose={() => setModal(null)}>
              <PointsForm customer={customer} onClose={() => setModal(null)} onSaved={handleSaved} />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
