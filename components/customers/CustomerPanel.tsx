'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, Coins, FileText, Mail, Pencil, Phone, UserCircle2 } from 'lucide-react';
import { useState } from 'react';

import { CustomerOrders } from '@/components/customers/CustomerOrders';
import { EditForm } from '@/components/customers/EditForm';
import { LoyaltyProgress } from '@/components/customers/LoyaltyProgress';
import { PointsForm } from '@/components/customers/PointsForm';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Modal } from '@/components/shared/Modal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { Customer } from '@/types/customers';

interface CustomerPanelProps {
  customer: Customer | null;
  onCustomerUpdate?: (c: Customer) => void;
}

export function CustomerPanel({ customer, onCustomerUpdate }: CustomerPanelProps) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'edit' | 'points' | null>(null);

  function handleSaved(updated: Customer) {
    qc.invalidateQueries({ queryKey: ['customers'] });
    onCustomerUpdate?.(updated);
  }

  return (
    <div className="w-100 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {!customer ? (
        <EmptyState icon={UserCircle2} title="No customer selected" description="Select a customer from the list to view their profile" />
      ) : (
        <>
          <ScrollArea className="flex-1">
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
              <div className="flex flex-col items-center px-6 pt-2 pb-6 text-center">
                <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} size="lg" className="mb-4" />
                <h2 className="text-2xl font-bold text-foreground leading-tight">
                  {customer.firstName} {customer.lastName}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Member since {new Date(customer.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="px-5 flex flex-col gap-4 pb-6">
                {/* Stats */}
                <div className="flex gap-4">
                  <StatCard label="Total Spent" value={customer.totalSpent ? `£${Number(customer.totalSpent).toFixed(2)}` : '—'} />
                  <StatCard label="Visits" value={(customer.totalVisits ?? 0).toLocaleString()} />
                </div>

                {/* Loyalty progress */}
                <LoyaltyProgress customer={customer} />

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
