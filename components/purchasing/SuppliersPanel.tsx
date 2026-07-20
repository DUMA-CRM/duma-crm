'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
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
      <div className="grid grid-cols-2 gap-3">
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
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted">
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Supplier</th>
                <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contact</th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setEditTarget(s)}
                  className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                >
                  <td className="px-3 md:px-5 py-3.5">
                    <p className="font-semibold text-foreground">{s.name}</p>
                    {s.address && <p className="text-xs text-muted-foreground truncate max-w-xs">{s.address}</p>}
                  </td>
                  <td className="hidden md:table-cell px-5 py-3.5 text-muted-foreground">
                    {[s.contactName, s.email, s.phone].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 md:px-5 py-3.5">
                    <Badge variant={s.isActive ? 'success' : 'muted'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
