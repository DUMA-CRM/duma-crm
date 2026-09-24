import {
  Activity,
  AlertTriangle,
  Banknote,
  Building2,
  CalendarDays,
  Coffee,
  Download,
  type IconComponent,
  Mail,
  Package,
  Receipt,
  Settings,
  ShieldOff,
  ShoppingBag,
  Trash2,
  Truck,
  UserCircle2,
  Users,
} from '@/components/icons';

import type { AuditSeverity } from '@/lib/audit/narrative';
import type { AuditLog } from '@/lib/modules/compliance/client';
import { cn } from '@/lib/utils/cn';

/**
 * The tinted square that opens every audit entry. It takes the glyph as a prop
 * — the resolver (`auditIcon`) picks one of a fixed set, and passing it in
 * keeps that choice out of the render body of the row and the inspector.
 *
 * Colour alone never carries the meaning here: the glyph itself changes for a
 * failure, a refusal and a deletion, and the row states each in words too.
 */
export function AuditGlyph({ icon: Icon, size, className }: { icon: IconComponent; size: number; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-sm', className)}>
      <Icon size={size} aria-hidden="true" />
    </span>
  );
}

// ── Glyphs ────────────────────────────────────────────────────────────────────

const RESOURCE_ICONS: [RegExp, IconComponent][] = [
  [/order|transaction|till|payment/, ShoppingBag],
  [/refund|receipt|cash-up|expense/, Receipt],
  [/supplier|purchase|delivery|restock/, Truck],
  [/stock|inventory|loss|unit/, Package],
  [/payslip|payroll/, Banknote],
  [/leave|shift|rota|schedul|absence|attendance/, CalendarDays],
  [/staff|employee|onboard|helpdesk|team/, Users],
  [/customer|loyalty|segment/, UserCircle2],
  [/email|marketing|suppression|message/, Mail],
  [/tenant|location|workspace/, Building2],
  [/setting|security|connection|device|trading|privacy/, Settings],
  [/menu|recipe|modifier/, Coffee],
  [/analytics|forecast|export/, Download],
];

export function auditIcon(log: AuditLog, severity: AuditSeverity): IconComponent {
  if (severity === 'failed') return AlertTriangle;
  if (severity === 'refused') return ShieldOff;
  if (severity === 'destructive') return Trash2;
  const haystack = `${log.resourceType} ${log.action}`.toLowerCase();
  for (const [pattern, icon] of RESOURCE_ICONS) {
    if (pattern.test(haystack)) return icon;
  }
  return Activity;
}
