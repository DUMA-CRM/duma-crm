'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, MapPin, Phone, Truck } from 'lucide-react';
import { useState } from 'react';

import { FormActions, inputClass, labelClass } from '@/components/purchasing/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';

import { type Supplier, type SupplierPayload, createSupplier, deactivateSupplier, updateSupplier } from '@/lib/api/purchasing.service';
import { toast } from '@/stores/toastStore';

function SupplierForm({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
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
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast('success', supplier ? 'Supplier updated.' : 'Supplier created.');
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
      <div>
        <label className={labelClass}>Name</label>
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} required minLength={2} className={inputClass} autoFocus />
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
      <FormActions onClose={onClose} isPending={isPending} submitLabel={supplier ? 'Update' : 'Create'} />
    </form>
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
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setDeactivateTarget(null);
      toast('success', 'Supplier deactivated.');
    },
    onError: (err) => toast('error', err.message || 'Failed to deactivate the supplier.'),
  });

  return (
    <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto">
        {suppliers.length === 0 ? (
          <div className="py-24">
            <EmptyState icon={Truck} title="No suppliers" description='Click "New Supplier" to add your first supplier.' />
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {suppliers.map((supplier) => (
              <button
                type="button"
                key={supplier.id}
                onClick={() => setEditTarget(supplier)}
                className="group rounded-xl border border-border bg-background p-4 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Truck size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{supplier.contactName || 'No contact assigned'}</p>
                    </div>
                  </div>
                  <Badge variant={supplier.isActive ? 'success' : 'muted'}>{supplier.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>

                <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
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
      </div>

      {createOpen && (
        <Modal title="New Supplier" onClose={() => onCreateOpenChange(false)}>
          <SupplierForm onClose={() => onCreateOpenChange(false)} />
        </Modal>
      )}
      {editTarget && (
        <Modal title="Edit Supplier" onClose={() => setEditTarget(null)}>
          <SupplierForm supplier={editTarget} onClose={() => setEditTarget(null)} />
          <button
            onClick={() => {
              setDeactivateTarget(editTarget);
              setEditTarget(null);
            }}
            className="mt-3 w-full h-9 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
          >
            Deactivate supplier
          </button>
        </Modal>
      )}
      {deactivateTarget && (
        <ConfirmModal
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
    </div>
  );
}
