import { PageLayout } from '@/components/layout/PageLayout';
import { StatCard } from '@/components/shared/StatCard';
import type { StatCardProps } from '@/components/shared/StatCard';

import { cn } from '@/lib/utils/cn';

const KPIS: StatCardProps[] = [
  {
    label: 'Revenue (Today)',
    value: '₴14,250',
    icon: 'Wallet',
    iconVariant: 'primary',
    delta: '+12%',
    deltaDirection: 'up',
    footer: { type: 'sparkline', points: [58, 62, 55, 70, 68, 74, 80, 76, 85, 90, 88, 95] },
  },
  {
    label: 'Orders',
    value: '100',
    icon: 'ShoppingBag',
    iconVariant: 'info',
    delta: '42 pending',
    footer: { type: 'bars', values: [55, 70, 48, 82, 65, 90, 100] },
  },
  {
    label: 'Avg Ticket',
    value: '₴76',
    icon: 'Tag',
    iconVariant: 'success',
    delta: '+₴4 vs last week',
    deltaDirection: 'up',
  },
  {
    label: 'New Customers',
    value: '9',
    icon: 'UserPlus',
    iconVariant: 'gold',
    delta: 'this week',
  },
];

const RECENT_ORDERS = [
  { name: 'Jordan Walker', tier: 'vip', initials: 'JW', color: '#e8590c', when: '2m ago', item: 'Flat White, Almond Tart', total: '₴150' },
  { name: 'Sam Chen', tier: 'vip', initials: 'SC', color: '#7a39bb', when: '14m ago', item: 'Matcha Latte (Oat)', total: '₴110' },
  {
    name: 'Elena Rodriguez',
    tier: 'silver',
    initials: 'ER',
    color: '#2d7a3a',
    when: '1h ago',
    item: 'Latte, Butter Croissant',
    total: '₴125',
  },
  { name: 'Priya Patel', tier: 'silver', initials: 'PP', color: '#b45309', when: '2h ago', item: 'Chai Latte', total: '₴85' },
];

const TIER_BADGE: Record<string, string> = {
  vip: 'bg-primary/10 text-primary',
  gold: 'bg-amber-100 text-amber-800',
  silver: 'bg-slate-100 text-slate-700',
  bronze: 'bg-amber-200 text-amber-800',
};

const BARS = [
  { day: 'Mon-1', label: 'Mon', h: 34 },
  { day: 'Tue-1', label: 'Tue', h: 42 },
  { day: 'Wed-1', label: 'Wed', h: 38 },
  { day: 'Thu-1', label: 'Thu', h: 55 },
  { day: 'Fri-1', label: 'Fri', h: 48 },
  { day: 'Sat-1', label: 'Sat', h: 62 },
  { day: 'Sun-1', label: 'Sun', h: 58 },
  { day: 'Mon-2', label: 'Mon', h: 70 },
  { day: 'Tue-2', label: 'Tue', h: 64 },
  { day: 'Wed-2', label: 'Wed', h: 78 },
  { day: 'Thu-2', label: 'Thu', h: 72 },
  { day: 'Fri-2', label: 'Fri', h: 85 },
];
const BAR_MAX = Math.max(...BARS.map((b) => b.h));

export default function DashboardPage() {
  return (
    <PageLayout eyebrow="At a Glance" title="Dashboard">
      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* ── Charts row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-4">
        {/* Revenue chart */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Revenue This Week</p>
              <p className="text-3xl font-bold text-foreground tabular-nums mt-1">₴84,120</p>
            </div>
            <div className="flex gap-1 bg-muted p-1 rounded-xl shrink-0">
              {['Week', 'Month', 'Quarter'].map((t, i) => (
                <button
                  key={t}
                  className={cn(
                    'px-3 h-8 rounded-lg text-xs font-bold tracking-widest uppercase transition-colors',
                    i === 0 ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-1.5 h-40">
            {BARS.map((b) => (
              <div key={b.day} className="flex-1 flex items-end">
                <div
                  className="w-full rounded-t-sm bg-linear-to-t from-primary to-amber-400 opacity-90"
                  style={{ height: `${(b.h / BAR_MAX) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2">
            {BARS.map((b) => (
              <div key={b.day} className="flex-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Orders</p>
            <button className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors">
              View All
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {RECENT_ORDERS.map((order) => (
              <div key={order.name} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: order.color }}
                >
                  {order.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {order.name}{' '}
                    <span
                      className={cn(
                        'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm align-middle',
                        TIER_BADGE[order.tier],
                      )}
                    >
                      {order.tier.toUpperCase()}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {order.item} · {order.when}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground shrink-0">{order.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
