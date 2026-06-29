'use client';

import { Building2, CalendarDays, FileText, Hash, MapPin, Package, Pencil, Trash2, Truck, X } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

import { type DeliveryRecord, type DeliveryStatus } from '@/lib/api/delivery.service';

// ── Helpers & constants ───────────────────────────────────────────────────────

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  received: 'Received',
  partial: 'Partial',
  cancelled: 'Cancelled',
};

export const STATUS_OPTIONS: DeliveryStatus[] = ['pending', 'received', 'partial', 'cancelled'];

export function statusVariant(s: DeliveryStatus): 'warning' | 'success' | 'primary' | 'muted' {
  if (s === 'pending') return 'warning';
  if (s === 'received') return 'success';
  if (s === 'partial') return 'primary';
  return 'muted';
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DeliverySidebarProps {
  delivery: DeliveryRecord | null;
  onClose: () => void;
  onEdit: (d: DeliveryRecord) => void;
  onDelete: (d: DeliveryRecord) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliverySidebar({ delivery, onClose, onEdit, onDelete }: DeliverySidebarProps) {
  if (!delivery) {
    return (
      <div className="w-115 shrink-0 border-l border-border bg-card flex items-center justify-center">
        <EmptyState icon={Truck} title="No delivery selected" description="Click a row to view full delivery details." />
      </div>
    );
  }

  const d = delivery;
  const supplierName = d.supplier?.name ?? '—';
  const locName = d.location?.name ?? '—';

  return (
    <div className="w-115 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Delivery</p>
            <p className="text-lg font-semibold text-foreground leading-snug truncate">{supplierName}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={statusVariant(d.status)}>{STATUS_LABELS[d.status]}</Badge>
              {d.items && d.items.length > 0 && (
                <Badge variant="muted">
                  {d.items.length} item{d.items.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 mt-0.5">
            <X size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-5 space-y-6">
          {/* Info */}
          <section>
            <Label uppercase className="mb-2.5 block">
              Details
            </Label>
            <InfoGroup>
              <InfoRow icon={Building2} label="Supplier" value={supplierName} />
              <InfoRow icon={MapPin} label="Location" value={locName} />
              <InfoRow icon={CalendarDays} label="Created" value={formatDate(d.createdAt)} />
              {d.deliveredAt && <InfoRow icon={CalendarDays} label="Delivered" value={formatDate(d.deliveredAt)} />}
              <InfoRow icon={Hash} label="Delivery ID" value={`#${d.id.toUpperCase()}`} copyable />
            </InfoGroup>
          </section>

          {/* Notes */}
          {d.notes && (
            <section>
              <Label uppercase className="mb-2.5 block">
                Notes
              </Label>
              <InfoGroup>
                <InfoRow icon={FileText} label="Notes" value={d.notes} />
              </InfoGroup>
            </section>
          )}

          {/* Items */}
          <section>
            <Label uppercase className="mb-2.5 block">
              Items
            </Label>
            {d.items && d.items.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 px-3 py-2 bg-surface-offset/50 border-b border-border">
                  {['Item', 'Qty', 'Unit'].map((h) => (
                    <span key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {h}
                    </span>
                  ))}
                </div>
                {d.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr] gap-3 px-3 py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Package size={11} className="text-primary" />
                      </div>
                      <span className="text-sm text-foreground truncate">{item.stockItem?.name ?? item.stockItemId.slice(0, 8)}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{item.quantity}</span>
                    <span className="text-sm text-muted-foreground">{item.stockItem?.unit ?? '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No item details available.</p>
            )}
          </section>
        </div>
      </ScrollArea>

      {/* Footer actions */}
      <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2">
        <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onEdit(d)}>
          <Pencil size={13} /> Edit
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive hover:text-white hover:border-destructive"
          onClick={() => onDelete(d)}
        >
          <Trash2 size={13} /> Delete
        </Button>
      </div>
    </div>
  );
}
