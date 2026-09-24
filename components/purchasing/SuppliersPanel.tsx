'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Mail, MapPin, Phone, Truck } from '@/components/icons';
import { FormActions, inputClass, labelClass } from '@/components/purchasing/shared';
import { ConfirmDrawer } from '@/components/shared/ConfirmDrawer';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';

import { type Supplier, type SupplierPayload, createSupplier, deactivateSupplier, updateSupplier } from '@/lib/modules/purchasing/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';

/** The form's id, so the drawer's pinned footer can submit it from outside. */
const SUPPLIER_FORM = 'supplier-form';

/** New or edit — the same fields either way, with save and deactivate pinned to the bottom. */
function SupplierDrawer({
  supplier,
  onClose,
  onDeactivate,
}: {
  supplier?: Supplier;
  onClose: () => void;
  /** Offered only when editing — hands the panel the confirm step. */
  onDeactivate?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<SupplierPayload>({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
    isActive: supplier?.isActive ?? true,
  });
  const set = (patch: Partial<SupplierPayload>) => setForm((f) => ({ ...f, ...patch }));

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload: SupplierPayload = {
        name: form.name,
        contactName: form.contactName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        isActive: form.isActive,
      };
      return supplier ? updateSupplier(supplier.id, payload) : createSupplier(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('suppliers') });
      toast('success', supplier ? 'Supplier updated.' : 'Supplier created.');
      onClose();
    },
  });

  return (
    <Drawer
      title={supplier ? 'Edit Supplier' : 'New Supplier'}
      description={supplier ? supplier.name : 'Who you buy from — used on purchase orders.'}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <FormActions formId={SUPPLIER_FORM} onClose={onClose} isPending={isPending} submitLabel={supplier ? 'Update' : 'Create'} />
          {onDeactivate && (
            <button
              type="button"
              onClick={onDeactivate}
              className="h-9 w-full rounded-sm border border-destructive/30 text-sm font-medium text-destructive transition-colors hover:bg-band"
            >
              Deactivate supplier
            </button>
          )}
        </div>
      }
    >
      <form
        id={SUPPLIER_FORM}
        onSubmit={(e) => {
          e.preventDefault();
          mutate();
        }}
        className="space-y-4"
      >
        <div>
          <label className={labelClass}>Name</label>
          <input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            required
            minLength={2}
            className={inputClass}
            autoFocus
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Contact name</label>
            <input value={form.contactName ?? ''} onChange={(e) => set({ contactName: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={form.email ?? ''} onChange={(e) => set({ email: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Address</label>
          <input value={form.address ?? ''} onChange={(e) => set({ address: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
            className={inputClass + ' h-auto py-2 resize-none'}
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set({ isActive: e.target.checked })}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">Active</span>
        </label>
        {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      </form>
    </Drawer>
  );
}

export function SuppliersPanel({
  suppliers,
  createOpen,
  onCreateOpenChange,
}: {
  suppliers: Supplier[];
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Supplier | null>(null);

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateSupplier(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('suppliers') });
      setDeactivateTarget(null);
      toast('success', 'Supplier deactivated.');
    },
    onError: (err) => toast('error', err.message || 'The supplier wasn’t deactivated. Try again.'),
  });

  return (
    <>
      {suppliers.length === 0 ? (
        <div className="rounded-sm border border-rule bg-card py-24 shadow-sm">
          <EmptyState icon={Truck} title="No suppliers yet" description="Add a supplier before creating a purchase order." />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((supplier) => (
            <button
              type="button"
              key={supplier.id}
              onClick={() => setEditTarget(supplier)}
              className="group rounded-sm border border-rule bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-band text-primary">
                    <Truck size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{supplier.contactName || 'No contact assigned'}</p>
                  </div>
                </div>
                <Badge variant={supplier.isActive ? 'success' : 'muted'}>{supplier.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>

              <div className="mt-4 space-y-2 border-t border-rule pt-3">
                <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{supplier.email || 'No email address'}</span>
                </p>
                <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <Phone size={12} className="shrink-0" />
                  <span className="truncate">{supplier.phone || 'No phone number'}</span>
                </p>
                <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <MapPin size={12} className="shrink-0" />
                  <span className="truncate">{supplier.address || 'No address'}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {createOpen && <SupplierDrawer onClose={() => onCreateOpenChange(false)} />}
      {editTarget && (
        <SupplierDrawer
          supplier={editTarget}
          onClose={() => setEditTarget(null)}
          onDeactivate={() => {
            setDeactivateTarget(editTarget);
            setEditTarget(null);
          }}
        />
      )}
      {deactivateTarget && (
        <ConfirmDrawer
          title="Deactivate Supplier"
          message={
            <>
              Deactivate <span className="font-semibold text-foreground">{deactivateTarget.name}</span>? Existing purchase orders keep
              referencing it.
            </>
          }
          isPending={deactivate.isPending}
          onConfirm={() => deactivate.mutate(deactivateTarget.id)}
          onClose={() => setDeactivateTarget(null)}
        />
      )}
    </>
  );
}
