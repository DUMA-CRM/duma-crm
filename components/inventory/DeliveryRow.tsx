'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, MapPin, Package, Pencil, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type DeliveryRecord, deleteDelivery } from '@/lib/api/delivery.service';
import { cn } from '@/lib/utils/cn';

import { formatDate, STATUS_LABELS, statusVariant } from './DeliverySidebar';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DeliveryRowProps {
  delivery: DeliveryRecord;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteError: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliveryRow({ delivery: d, selected, onSelect, onEdit, onDelete, onDeleteError }: DeliveryRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { mutate: remove, isPending } = useMutation({
    mutationFn: () => deleteDelivery(d.id),
    onSuccess: onDelete,
    onError: onDeleteError,
  });

  const supplierName = d.supplier?.name ?? '—';
  const locName = d.location?.name ?? '—';
  const itemCount = d.items?.length ?? 0;

  return (
    <div className="border-b border-border/50 last:border-0">
      <div
        onClick={onSelect}
        className={cn(
          'grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1.2fr_64px] gap-4 px-4 py-3 cursor-pointer',
          'hover:bg-surface-offset/40 transition-colors',
          selected && 'bg-primary/5 border-l-2 border-l-primary',
        )}
      >
        {/* Supplier */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors', selected ? 'bg-primary/20' : 'bg-primary/10')}>
            <Truck size={13} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{supplierName}</p>
            {d.notes && <p className="text-[11px] text-muted-foreground truncate">{d.notes}</p>}
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <MapPin size={13} className="shrink-0" />
          <span className="truncate">{locName}</span>
        </div>

        {/* Items */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Package size={13} className="shrink-0" />
          <span>{itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : '—'}</span>
        </div>

        {/* Status */}
        <div className="flex items-center">
          <Badge variant={statusVariant(d.status)}>{STATUS_LABELS[d.status]}</Badge>
        </div>

        {/* Created */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays size={13} className="shrink-0" />
          <span>{formatDate(d.createdAt)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/5 border-t border-destructive/10">
          <AlertTriangle size={14} className="text-destructive shrink-0" />
          <p className="text-xs text-destructive flex-1">Delete this delivery? This cannot be undone.</p>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            size="sm"
            className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
            disabled={isPending}
            onClick={() => remove()}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      )}
    </div>
  );
}
