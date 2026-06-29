'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Clock, Mail, Package, Phone, Plus, Shield, Star, Truck } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { type Supplier, type SupplierPayload, createSupplier, deleteSupplier, getSuppliers, updateSupplier } from '@/lib/api/supplier.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Shared styles ─────────────────────────────────────────────────────────────

const textareaClass = cn(
  'w-full bg-surface-offset border border-transparent rounded-lg px-3 py-2 text-sm text-foreground',
  'placeholder:text-muted-foreground outline-none resize-none',
  'focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150',
);

const btnRow = 'flex gap-2 pt-1';
const btnCancel = 'flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors';
const btnPrimary = 'flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, valueClass }: { label: string; value: number; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <p className={cn('text-3xl font-bold text-foreground', valueClass)}>{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Tip card ──────────────────────────────────────────────────────────────────

interface TipCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant: 'primary' | 'success' | 'warning' | 'muted';
}

const TIP_COLORS = {
  primary: { bg: 'bg-primary/5 border-primary/15', iconBg: 'bg-primary/10', iconText: 'text-primary' },
  success: { bg: 'bg-success/5 border-success/15', iconBg: 'bg-success/10', iconText: 'text-success' },
  warning: { bg: 'bg-warning/5 border-warning/15', iconBg: 'bg-warning/10', iconText: 'text-warning' },
  muted: { bg: 'bg-surface-offset border-border', iconBg: 'bg-muted', iconText: 'text-muted-foreground' },
};

function TipCard({ icon, title, description, variant }: TipCardProps) {
  const c = TIP_COLORS[variant];
  return (
    <div className={cn('rounded-xl border p-4 flex gap-3', c.bg)}>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', c.iconBg, c.iconText)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-foreground mb-0.5">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── Supplier avatar ───────────────────────────────────────────────────────────


// ── Supplier form ─────────────────────────────────────────────────────────────

interface SupplierFormProps {
  initial?: Supplier;
  onSubmit: (data: Omit<SupplierPayload, 'tenantId'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isPending: boolean;
  isDeletePending?: boolean;
}

function SupplierForm({ initial, onSubmit, onCancel, onDelete, isPending, isDeletePending }: SupplierFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [contactName, setContactName] = useState(initial?.contactName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nameError, setNameError] = useState('');

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Supplier name is required.'); return; }
    onSubmit({ name: name.trim(), contactName: contactName.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial && (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 border border-border rounded-xl">
          <InitialsAvatar firstName={initial.name.split(' ')[0] ?? ''} lastName={initial.name.split(' ')[1] ?? ''} />
          <div>
            <p className="text-sm font-semibold text-foreground">{initial.name}</p>
            {initial.email && <p className="text-xs text-muted-foreground">{initial.email}</p>}
          </div>
        </div>
      )}

      <Input
        label="SUPPLIER NAME"
        value={name}
        onChange={(e) => { setName(e.target.value); setNameError(''); }}
        placeholder="e.g. Coffee Beans Co."
        required
        error={nameError}
        autoFocus={!initial}
      />

      <Input
        label="CONTACT NAME"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        placeholder="e.g. Jane Smith"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="EMAIL"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="supplier@example.com"
          leftIcon={<Mail size={14} />}
        />
        <Input
          label="PHONE"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+44 20 0000 0000"
          leftIcon={<Phone size={14} />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label uppercase>Address</Label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Industrial Way, London, EC1A 1BB"
          rows={2}
          maxLength={500}
          className={textareaClass}
        />
      </div>

      {onDelete && (
        <>
          <div className="border-t border-border pt-3">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-xs text-destructive font-medium">This will permanently remove the supplier. Are you sure?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 h-9 border border-border rounded-xl text-xs font-medium text-muted-foreground hover:bg-surface-offset transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={onDelete} disabled={isDeletePending} className="flex-1 h-9 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold rounded-xl transition-colors disabled:opacity-60">
                    {isDeletePending ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="w-full h-9 border border-destructive/30 text-destructive text-xs font-medium rounded-xl hover:bg-destructive/10 transition-colors">
                Remove Supplier
              </button>
            )}
          </div>
        </>
      )}

      <div className={btnRow}>
        <button type="button" onClick={onCancel} className={btnCancel}>Cancel</button>
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending ? 'Saving…' : initial ? 'Save Changes' : 'Add Supplier'}
        </button>
      </div>
    </form>
  );
}

// ── Supplier row ──────────────────────────────────────────────────────────────

function SupplierRow({ supplier, onEdit }: { supplier: Supplier; onEdit: (s: Supplier) => void }) {
  return (
    <tr
      onClick={() => onEdit(supplier)}
      className="group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <InitialsAvatar firstName={supplier.name.split(' ')[0] ?? ''} lastName={supplier.name.split(' ')[1] ?? ''} />
          <p className="text-sm font-semibold text-foreground truncate max-w-45">{supplier.name}</p>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-sm text-foreground">{supplier.contactName ?? <span className="text-muted-foreground">—</span>}</span>
      </td>
      <td className="px-5 py-3.5">
        {supplier.email ? (
          <a
            href={`mailto:${supplier.email}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-primary hover:underline"
          >
            {supplier.email}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        {supplier.phone ? (
          <a
            href={`tel:${supplier.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-foreground hover:text-primary transition-colors"
          >
            {supplier.phone}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-5 py-3.5 max-w-[200px]">
        <span className="text-sm text-muted-foreground truncate block max-w-50" title={supplier.address}>
          {supplier.address ?? '—'}
        </span>
      </td>
      <td className="px-5 py-3.5 pr-6 text-right">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(supplier.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ActiveModal = { type: 'create' } | { type: 'edit'; supplier: Supplier };

export default function SupplierManagementPage() {
  const { tenantId } = useWorkspaceStore();
  const qc = useQueryClient();
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const close = () => setModal(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', tenantId],
    queryFn: () => getSuppliers(),
    enabled: !!tenantId,
  });

  const { mutate: create, isPending: createPending } = useMutation({
    mutationFn: (data: Omit<SupplierPayload, 'tenantId'>) => createSupplier({ tenantId: tenantId!, ...data }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['suppliers', tenantId] }); close(); },
  });

  const { mutate: update, isPending: updatePending } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<SupplierPayload, 'tenantId'> }) => updateSupplier(id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['suppliers', tenantId] }); close(); },
  });

  const { mutate: remove, isPending: deletePending } = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['suppliers', tenantId] }); close(); },
  });

  // Stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const statTotal = suppliers.length;
  const statWithContact = suppliers.filter((s) => s.contactName).length;
  const statReachable = suppliers.filter((s) => s.email).length;
  const statNew = suppliers.filter((s) => new Date(s.createdAt) >= startOfMonth).length;

  return (
    <>
      <PageLayout
        eyebrow="Operations"
        title="Supplier Management"
        headerBorder={false}
        fullHeight
        headerSlot={
          tenantId ? (
            <Button onClick={() => setModal({ type: 'create' })} size="sm" className="gap-1.5">
              <Plus size={14} />
              Add Supplier
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col h-full gap-4 overflow-hidden">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            <StatCard label="Total Suppliers" value={statTotal} />
            <StatCard label="With Contact" value={statWithContact} sub={statTotal > 0 ? `${Math.round((statWithContact / statTotal) * 100)}% of roster` : undefined} valueClass="text-primary" />
            <StatCard label="Email-Ready" value={statReachable} sub="Can receive orders" valueClass={statReachable > 0 ? 'text-success' : undefined} />
            <StatCard label="Added This Month" value={statNew} valueClass={statNew > 0 ? 'text-warning' : undefined} />
          </div>

          {/* Tips */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            <TipCard
              icon={<Shield size={15} />}
              variant="warning"
              title="Backup suppliers"
              description="Keep a secondary supplier for high-demand items. Disruptions hit less hard when you have alternatives."
            />
            <TipCard
              icon={<Package size={15} />}
              variant="primary"
              title="Consolidate orders"
              description="Grouping orders from the same supplier lowers shipping costs and builds leverage for better pricing."
            />
            <TipCard
              icon={<Clock size={15} />}
              variant="muted"
              title="Know lead times"
              description="Ask each supplier for their typical delivery window. Factor this into your restock request timing."
            />
            <TipCard
              icon={<Star size={15} />}
              variant="success"
              title="Review performance"
              description="Track on-time delivery, quality consistency, and responsiveness. Switch early if standards slip."
            />
          </div>

          {/* Table */}
          <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted/40">
                    {['Supplier', 'Contact', 'Email', 'Phone', 'Address', 'Added'].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          'px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest',
                          i === 5 ? 'text-right pr-6' : 'text-left',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 40)}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : !tenantId ? (
                    <tr>
                      <td colSpan={6} className="py-24">
                        <EmptyState icon={Truck} title="No workspace selected" description="Select a workspace to manage suppliers." />
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-24">
                        <EmptyState icon={Building2} title="No suppliers yet" description='Click "Add Supplier" to start tracking inventory sources.' />
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => (
                      <SupplierRow key={s.id} supplier={s} onEdit={(s) => setModal({ type: 'edit', supplier: s })} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {suppliers.length > 0 && (
              <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'} · {statReachable} email-ready
                </p>
                <p className="text-xs text-muted-foreground">Click a row to edit</p>
              </div>
            )}
          </div>
        </div>
      </PageLayout>

      {modal?.type === 'create' && tenantId && (
        <Modal title="Add Supplier" onClose={close}>
          <SupplierForm
            onSubmit={(data) => create(data)}
            onCancel={close}
            isPending={createPending}
          />
        </Modal>
      )}

      {modal?.type === 'edit' && (
        <Modal title="Edit Supplier" onClose={close}>
          <SupplierForm
            initial={modal.supplier}
            onSubmit={(data) => update({ id: modal.supplier.id, data })}
            onCancel={close}
            onDelete={() => remove(modal.supplier.id)}
            isPending={updatePending}
            isDeletePending={deletePending}
          />
        </Modal>
      )}
    </>
  );
}
