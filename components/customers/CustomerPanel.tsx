import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Pencil, MoreHorizontal, Star, Clock, Coffee, Cake, ShoppingBag, Gift, Wallet, UserCircle2, Send } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Customer, Tier, OrderStatus } from '@/types/customers';
import { VisitCalendar } from './VisitCalendar';

// ── Tier config ───────────────────────────────────────────────
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
    label: 'VIP Status',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    progressFrom: 'Gold',
    progressTo: 'Platinum',
    progressPct: 72,
    nextTier: 'Platinum',
    ptsToNext: 750,
  },
  gold: {
    label: 'Gold Status',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    progressFrom: 'Silver',
    progressTo: 'VIP',
    progressPct: 45,
    nextTier: 'VIP',
    ptsToNext: 500,
  },
  silver: {
    label: 'Silver Status',
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
    progressFrom: 'Bronze',
    progressTo: 'Gold',
    progressPct: 30,
    nextTier: 'Gold',
    ptsToNext: 200,
  },
  bronze: {
    label: 'Bronze Status',
    badgeClass: 'bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    progressFrom: 'None',
    progressTo: 'Silver',
    progressPct: 15,
    nextTier: 'Silver',
    ptsToNext: 100,
  },
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  done: { label: 'Paid', className: 'bg-success/10 text-success' },
  ready: { label: 'Ready', className: 'bg-warning/10 text-warning' },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/10 text-destructive' },
};

// ── Preference chip icons ─────────────────────────────────────
const PREF_ICONS: Record<string, React.ElementType> = {
  'Alt Milk': Coffee,
  'Espresso Fan': Coffee,
  'Milk-Based': Coffee,
  Snacks: Cake,
  Chai: Coffee,
  Regulars: Star,
  Subscription: Clock,
  default: Coffee,
};

// ── Activity icon map ─────────────────────────────────────────
const ACTIVITY_ICONS: Record<OrderStatus, { icon: React.ElementType; iconClass: string }> = {
  done: { icon: ShoppingBag, iconClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' },
  ready: { icon: Clock, iconClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' },
  pending: { icon: Wallet, iconClass: 'bg-muted text-muted-foreground' },
  cancelled: { icon: Gift, iconClass: 'bg-muted text-muted-foreground' },
};

// ─── Sub-components ───────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 bg-background rounded-2xl p-4 border border-border">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function PrefChip({ label }: { label: string }) {
  const Icon = PREF_ICONS[label] ?? PREF_ICONS.default;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-background border border-border text-sm font-medium text-foreground">
      <Icon size={14} className="text-primary shrink-0" />
      {label}
    </span>
  );
}

function EmptyPanel({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <UserCircle2 size={28} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-muted-foreground">No customer selected</p>
      <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[180px]">Select a customer from the list to view their profile</p>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────
interface CustomerPanelProps {
  customer: Customer | null;
  onClose?: () => void;
}

export function CustomerPanel({ customer, onClose }: CustomerPanelProps) {
  return (
    <div className="w-100 shrink-0 border-l border-border bg-muted/30 flex flex-col overflow-hidden">
      {!customer ? (
        <EmptyPanel />
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {/* ── Top bar ──────────────────────────────── */}
              <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground active:bg-muted transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="flex gap-2">
                  <button className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground active:bg-muted transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground active:bg-muted transition-colors">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>

              {/* ── Avatar + name ────────────────────────── */}
              <div className="flex flex-col items-center px-6 pt-4 pb-6 text-center">
                {/* Avatar with tier badge */}
                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-background shadow-lg">
                    <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
                  </div>
                  {/* Tier badge */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-400 border-2 border-background flex items-center justify-center shadow">
                    <Star size={14} className="text-amber-900 fill-amber-900" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-foreground leading-tight">{customer.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Client since{' '}
                  {new Date(customer.joinedAt).toLocaleDateString('en-GB', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="px-5 flex flex-col gap-4 pb-6">
                {/* ── Stat cards ─────────────────────────── */}
                <div className="flex gap-3">
                  <StatCard label="Lifetime Value" value={`₴${customer.totalSpent.toLocaleString()}`} />
                  <StatCard label="Visit Frequency" value={`${(customer.totalOrders / 12).toFixed(1)}`} sub="/ month avg" />
                </div>

                {/* ── Loyalty progress ───────────────────── */}
                {(() => {
                  const tier = TIER_CONFIG[customer.tier];
                  return (
                    <div className="bg-background rounded-2xl p-4 border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Loyalty Progress</p>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-lg font-bold text-foreground">{tier.label}</p>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {tier.ptsToNext} pts to {tier.nextTier}
                        </p>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-amber-600 to-amber-400 transition-all duration-500"
                          style={{ width: `${tier.progressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{tier.progressFrom}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{tier.progressTo}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Preferences ────────────────────────── */}
                {customer.tags.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Connoisseur Preferences</p>
                    <div className="flex flex-wrap gap-2">
                      {customer.tags.map((tag) => (
                        <PrefChip key={tag} label={tag} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Recent activity ────────────────────── */}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Recent Activity</p>
                  <div className="relative flex flex-col">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[18px] top-5 bottom-5 w-px bg-border" />

                    {customer.recentOrders.map((order, i) => {
                      const activity = ACTIVITY_ICONS[order.status];
                      const Icon = activity.icon;
                      return (
                        <div key={order.id} className="flex gap-3 relative mb-4 last:mb-0">
                          {/* Icon bubble */}
                          <div
                            className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-background',
                              activity.iconClass,
                            )}
                          >
                            <Icon size={15} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 pt-1.5 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-tight">{order.items}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              ₴{order.total.toFixed(2)} ·{' '}
                              {new Date(order.date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </p>
                          </div>

                          {/* Status dot */}
                          <span
                            className={cn(
                              'self-start mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0',
                              STATUS_CONFIG[order.status].className,
                            )}
                          >
                            {STATUS_CONFIG[order.status].label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-5">
            <VisitCalendar visits={customer.visits} months={6} />
          </div>

          {/* ── CTA ──────────────────────────────────────── */}
          <div className="p-5 border-t border-border shrink-0">
            <button className="w-full h-12 rounded-2xl border-2 border-primary text-primary text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 active:bg-primary/5 transition-colors">
              <Send size={15} />
              Send Personalized Offer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
