'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Star,
  Phone,
  Mail,
  Calendar,
  FileText,
  Coins,
  UserCircle2,
  Check,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatCard } from '@/components/shared/StatCard';
import { Modal } from '@/components/shared/Modal';
import { updateCustomer, adjustPoints, type Customer } from '@/lib/api/customers.service';
import { getOrders, type Order, type OrderStatus } from '@/lib/api/orders.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils/cn';
import type { Tier } from '@/types/customers';

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  Tier,
  {
    label: string;
    badgeClass: string;
    progressFrom: string;
    progressTo: string;
    progressPct: number;
    nextTier: string;
    ptsToNext: number;
  }
> = {
  vip: {
    label: 'VIP',
    badgeClass: 'bg-primary/10 text-primary',
    progressFrom: 'Gold',
    progressTo: 'Platinum',
    progressPct: 72,
    nextTier: 'Platinum',
    ptsToNext: 750,
  },
  gold: {
    label: 'Gold',
    badgeClass: 'bg-warning/10 text-warning',
    progressFrom: 'Silver',
    progressTo: 'VIP',
    progressPct: 45,
    nextTier: 'VIP',
    ptsToNext: 500,
  },
  silver: {
    label: 'Silver',
    badgeClass: 'bg-muted text-muted-foreground',
    progressFrom: 'Bronze',
    progressTo: 'Gold',
    progressPct: 30,
    nextTier: 'Gold',
    ptsToNext: 200,
  },
  bronze: {
    label: 'Bronze',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
    progressFrom: 'None',
    progressTo: 'Silver',
    progressPct: 15,
    nextTier: 'Silver',
    ptsToNext: 100,
  },
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  preparing: { label: 'Preparing', className: 'bg-warning/10 text-warning' },
  ready: { label: 'Ready', className: 'bg-primary/10 text-primary' },
  done: { label: 'Done', className: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Initials({ firstName, lastName, size = 'lg' }: { firstName: string; lastName: string; size?: 'lg' | 'sm' }) {
  return (
    <div
      className={cn(
        'rounded-full bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white font-bold select-none shrink-0',
        size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-10 h-10 text-sm',
      )}
    >
      {firstName[0]?.toUpperCase()}
      {lastName[0]?.toUpperCase()}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon size={13} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0.5">{label}</p>
        <p className="text-sm text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

const inp =
  'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

// ── Edit form ─────────────────────────────────────────────────────────────────

function EditForm({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: (c: Customer) => void }) {
  const [firstName, setFirstName] = useState(customer.firstName);
  const [lastName, setLastName] = useState(customer.lastName);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email ?? '');
  const [dob, setDob] = useState(customer.dob ? customer.dob.slice(0, 10) : '');
  const [notes, setNotes] = useState(customer.notes ?? '');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateCustomer(customer.id, {
        firstName,
        lastName,
        phone,
        email: email || undefined,
        dob: dob ? new Date(dob).toISOString() : undefined,
        notes: notes || undefined,
      }),
    onSuccess: (updated) => {
      onSaved(updated);
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inp} autoFocus />
        </div>
        <div>
          <label className={lbl}>Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required className={inp} />
      </div>
      <div>
        <label className={lbl}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} placeholder="optional" />
      </div>
      <div>
        <label className={lbl}>Date of birth</label>
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inp} />
      </div>
      <div>
        <label className={lbl}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inp + ' h-auto py-2.5 resize-none'}
          placeholder="Internal notes…"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

// ── Points form ───────────────────────────────────────────────────────────────

function PointsForm({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: (c: Customer) => void }) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const deltaNum = parseInt(delta, 10) || 0;
  const preview = Math.max(0, customer.pointsBalance + deltaNum);

  const { mutate, isPending } = useMutation({
    mutationFn: () => adjustPoints(customer.id, deltaNum, reason || undefined),
    onSuccess: (updated) => {
      onSaved(updated);
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (deltaNum !== 0) mutate();
      }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
        <span className="text-sm text-muted-foreground">Current balance</span>
        <span className="text-sm font-semibold text-foreground">{customer.pointsBalance.toLocaleString()} pts</span>
      </div>
      <div>
        <label className={lbl}>Adjustment (+ or −)</label>
        <input
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          required
          pattern="^-?\d+"
          placeholder="+100 or -50"
          className={inp}
          autoFocus
        />
      </div>
      <div>
        <label className={lbl}>Reason (optional)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Birthday bonus, correction…" className={inp} />
      </div>
      {deltaNum !== 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-muted-foreground">New balance</span>
          <span className="text-sm font-semibold text-foreground">{preview.toLocaleString()} pts</span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || deltaNum === 0}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </form>
  );
}

// ── Orders section ────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const s = STATUS_CONFIG[order.status];
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <ShoppingBag size={13} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-muted-foreground truncate">#{order.id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn('text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md', s.className)}>{s.label}</span>
        {order.totalAmount != null && (
          <span className="text-xs font-semibold text-foreground tabular-nums">£{(order.totalAmount / 1).toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}

function CustomerOrders({ customerId }: { customerId: string }) {
  const { locationId } = useWorkspaceStore();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-orders', customerId, locationId, page],
    queryFn: () =>
      getOrders({
        customerId,
        locationId: locationId ?? undefined,
        page,
        limit: 20,
      }),
  });

  const orders = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Orders</p>
        {data && <span className="text-xs text-muted-foreground">{data.total} total</span>}
      </div>

      <div className="bg-background rounded-2xl border border-border px-3 py-1">
        {isLoading ? (
          <div className="flex flex-col gap-3 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                </div>
                <div className="h-5 w-14 bg-muted rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">No orders found.</p>
        ) : (
          orders.map((o) => <OrderRow key={o.id} order={o} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-7 px-2 flex items-center gap-1 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <ChevronLeft size={13} aria-hidden="true" />
            Prev
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-7 px-2 flex items-center gap-1 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            Next
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-3">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <UserCircle2 size={28} className="text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-muted-foreground">No customer selected</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-40">Select a customer from the list to view their profile</p>
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

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
        <EmptyPanel />
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {/* Top bar */}
              <div className="flex items-center justify-end gap-2 px-5 pt-5 pb-2">
                <button
                  onClick={() => setModal('points')}
                  className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-warning hover:border-warning/50 transition-colors"
                  aria-label="Adjust points"
                >
                  <Coins size={15} />
                </button>
                <button
                  onClick={() => setModal('edit')}
                  className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Edit customer"
                >
                  <Pencil size={15} />
                </button>
              </div>

              {/* Avatar + name */}
              <div className="flex flex-col items-center px-6 pt-2 pb-6 text-center">
                <div className="relative mb-4">
                  <Initials firstName={customer.firstName} lastName={customer.lastName} size="lg" />
                  <div
                    className={cn(
                      'absolute bottom-0 right-0 w-8 h-8 rounded-full border-2 border-background flex items-center justify-center shadow',
                      TIER_CONFIG[customer.tier].badgeClass,
                    )}
                  >
                    <Star size={13} className="fill-current" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground leading-tight">
                  {customer.firstName} {customer.lastName}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Member since {new Date(customer.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="px-5 flex flex-col gap-4 pb-6">
                {/* Stats */}
                <div className="flex gap-3">
                  <StatCard label="Total Spent" value={customer.totalSpent != null ? `£${(customer.totalSpent / 1).toFixed(2)}` : '—'} />
                  <StatCard label="Visits" value={(customer.totalVisits ?? 0).toLocaleString()} />
                </div>

                {/* Loyalty progress */}
                {(() => {
                  const t = TIER_CONFIG[customer.tier];
                  return (
                    <div className="bg-background rounded-2xl p-4 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Loyalty</p>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', t.badgeClass)}>
                          {t.label}
                        </span>
                      </div>
                      <div className="flex items-end justify-between mt-2 mb-3">
                        <p className="text-2xl font-bold text-foreground tabular-nums">
                          {customer.pointsBalance.toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground ml-1">pts</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.ptsToNext} to {t.nextTier}
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-amber-600 to-amber-400 transition-all duration-500"
                          style={{ width: `${t.progressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.progressFrom}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.progressTo}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Contact details */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Contact</p>
                  <div className="bg-background rounded-2xl border border-border px-3 py-1">
                    <InfoRow icon={Phone} label="Phone" value={customer.phone} />
                    {customer.email && <InfoRow icon={Mail} label="Email" value={customer.email} />}
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
                  </div>
                </div>

                {/* Notes */}
                {customer.notes && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Notes</p>
                    <div className="bg-background rounded-2xl border border-border px-4 py-3 flex gap-2.5">
                      <FileText size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
                    </div>
                  </div>
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
