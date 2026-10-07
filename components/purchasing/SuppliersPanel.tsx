'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import {
  AlertTriangle,
  Ban,
  Building2,
  FileText,
  type IconComponent,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Power,
  RotateCcw,
  Search,
  Truck,
  UserRound,
  X,
} from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { FormSection } from '@/components/shared/FormParts';
import { Pill } from '@/components/shared/Pill';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { type Supplier, type SupplierPayload, createSupplier, deactivateSupplier, updateSupplier } from '@/lib/modules/purchasing/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import {
  type SupplierForm,
  type SupplierView,
  filterSuppliers,
  missingDetails,
  supplierFormErrors,
  supplierInitials,
  supplierPayload,
  unreachable,
} from '@/lib/utils/suppliers';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/*
 * Suppliers as business cards, three to a row like the card readers in
 * Settings: a search and a status selector, then one card per supplier with the
 * ways to reach them on it. The drawer is the record.
 */

const SUPPLIER_FORM = 'supplier-form';

const toForm = (supplier?: Supplier): SupplierForm => ({
  name: supplier?.name ?? '',
  contactName: supplier?.contactName ?? '',
  email: supplier?.email ?? '',
  phone: supplier?.phone ?? '',
  address: supplier?.address ?? '',
  notes: supplier?.notes ?? '',
});

/**
 * New or edit, the same drawer: a live business card on top so you see what
 * the grid will show, then the fields in sections. Status is not a field —
 * deactivating is its own capability (`suppliers:delete`), so it is a mode of
 * the drawer with its own confirm, the way a refund is in the order drawer. An
 * inactive supplier opens read-only with Reactivate as the one action.
 */
function SupplierDrawer({
  supplier,
  canWrite,
  canDelete,
  onClose,
}: {
  supplier?: Supplier;
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = Boolean(supplier);
  const inactive = supplier ? !supplier.isActive : false;
  const [confirming, setConfirming] = useState(false);
  const [initial] = useState(() => toForm(supplier));
  const [form, setForm] = useState(initial);
  // A field shows its error once it has been changed and left, or after a save
  // attempt — never on opening, when an empty name is not yet a mistake.
  const [touched, setTouched] = useState<Partial<Record<keyof SupplierForm, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const errors = supplierFormErrors(form, Boolean(supplier?.email?.trim()));
  const valid = Object.keys(errors).length === 0;
  const dirty = (Object.keys(form) as (keyof SupplierForm)[]).some((key) => form[key].trim() !== initial[key].trim());
  const readOnly = !canWrite || inactive;
  const errorFor = (key: keyof SupplierForm) => (touched[key] || submitted ? errors[key] : undefined);
  const field = (key: keyof SupplierForm) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
    onBlur: () => setTouched((current) => (form[key] !== initial[key] ? { ...current, [key]: true } : current)),
    disabled: readOnly,
    error: errorFor(key),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('suppliers') });
  const save = useMutation({
    mutationFn: () => {
      const payload: SupplierPayload = supplierPayload(form, editing);
      return supplier ? updateSupplier(supplier.id, payload) : createSupplier({ ...payload, isActive: true });
    },
    onSuccess: () => {
      invalidate();
      toast('success', supplier ? 'Supplier updated.' : `${form.name.trim()} added.`);
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The supplier wasn’t saved. Try again.'),
  });
  const reactivate = useMutation({
    mutationFn: () => updateSupplier(supplier!.id, { name: supplier!.name, isActive: true }),
    onSuccess: () => {
      invalidate();
      toast('success', `${supplier!.name} can be ordered from again.`);
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The supplier wasn’t reactivated. Try again.'),
  });
  const deactivate = useMutation({
    mutationFn: () => deactivateSupplier(supplier!.id),
    onSuccess: () => {
      invalidate();
      toast('success', `${supplier!.name} deactivated.`);
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The supplier wasn’t deactivated. Try again.'),
  });
  const pending = save.isPending || reactivate.isPending || deactivate.isPending;
  const { error: notesError, ...notesField } = field('notes');
  const noWayToReach = !form.email.trim() && !form.phone.trim();

  let footer: React.ReactNode;
  if (!canWrite) footer = undefined;
  else if (confirming)
    footer = (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirming(false)} disabled={pending}>
          Keep active
        </Button>
        <Button variant="destructive" size="lg" className="flex-1" onClick={() => deactivate.mutate()} disabled={pending}>
          {deactivate.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Power aria-hidden="true" />}
          Deactivate supplier
        </Button>
      </div>
    );
  else if (inactive)
    footer = (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={pending}>
          Close
        </Button>
        <Button size="lg" className="flex-1" onClick={() => reactivate.mutate()} disabled={pending}>
          {reactivate.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
          Reactivate
        </Button>
      </div>
    );
  else
    footer = (
      <div className="flex items-center gap-2">
        {supplier && canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="text-exception hover:bg-exception/6 hover:text-exception"
            onClick={() => setConfirming(true)}
            disabled={pending}
          >
            <Power aria-hidden="true" />
            Deactivate
          </Button>
        )}
        <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form={SUPPLIER_FORM} size="lg" className="flex-1" disabled={pending || (editing && !dirty)}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {supplier ? 'Save changes' : 'Add supplier'}
        </Button>
      </div>
    );

  return (
    <Drawer
      title={confirming ? 'Deactivate supplier' : inactive ? 'Inactive supplier' : supplier ? 'Edit supplier' : 'New supplier'}
      description={
        confirming
          ? 'Check what changes before you confirm.'
          : inactive
            ? 'Kept for the orders it’s on. Reactivate to order from them or edit.'
            : supplier
              ? 'Changes show on new purchase orders straight away.'
              : 'Who you buy from — you’ll pick them on purchase orders.'
      }
      onClose={onClose}
      footer={footer}
    >
      <AnimatePresence mode="wait" initial={false}>
        {confirming && supplier ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            <CardPreview form={initial} status="leaving" />
            <DeactivateConsequences name={supplier.name} />
          </motion.div>
        ) : (
          <motion.form
            key="form"
            id={SUPPLIER_FORM}
            noValidate
            className="space-y-7"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
              if (valid && !pending && !readOnly) save.mutate();
            }}
          >
            <CardPreview form={form} status={!supplier ? undefined : inactive ? 'inactive' : 'active'} />

            {inactive && (
              <div className="flex items-start gap-3 rounded-lg border border-rule/60 bg-band/50 px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
                  <Power size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 text-xs leading-relaxed text-muted-foreground">
                  <p className="text-sm font-semibold text-foreground">Inactive</p>
                  Past purchase orders still show {supplier?.name}; it can’t be picked for new ones.
                  {!canWrite && ' Ask someone who manages suppliers to reactivate it.'}
                  {supplier?.updatedAt && <span className="mt-1 block text-micro">Last updated {formatDay(supplier.updatedAt)}</span>}
                </div>
              </div>
            )}

            {readOnly && supplier ? (
              <ReadOnlyDetails supplier={supplier} />
            ) : (
              <>
                <FormSection icon={Building2} title="Business">
                  <Input label="Name" required autoFocus={!supplier} placeholder="e.g. Dairy Direct" maxLength={255} {...field('name')} />
                  <Input
                    label="Address"
                    leftIcon={<MapPin size={14} />}
                    placeholder="Where deliveries come from"
                    maxLength={500}
                    {...field('address')}
                  />
                </FormSection>

                <FormSection icon={UserRound} title="Contact">
                  <Input label="Contact person" placeholder="e.g. Priya Shah" maxLength={255} {...field('contactName')} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Email"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      leftIcon={<Mail size={14} />}
                      placeholder="orders@…"
                      maxLength={255}
                      {...field('email')}
                    />
                    <Input
                      label="Phone"
                      type="tel"
                      inputMode="tel"
                      leftIcon={<Phone size={14} />}
                      placeholder="Optional"
                      maxLength={30}
                      {...field('phone')}
                    />
                  </div>
                  {noWayToReach && !readOnly && (
                    <p className="flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs text-measured">
                      <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
                      Add an email or a phone number so a late delivery can be chased.
                    </p>
                  )}
                </FormSection>

                <FormSection icon={FileText} title="Notes">
                  <textarea
                    {...notesField}
                    aria-label="Notes"
                    rows={4}
                    maxLength={2000}
                    placeholder={readOnly ? 'No notes' : 'e.g. Account DD-4471. Delivers Mon and Thu before 8am.'}
                    className="w-full resize-none rounded-md border border-input bg-control px-3 py-2 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured disabled:opacity-50 sm:text-sm"
                  />
                  {notesError && <p className="text-xs font-semibold text-destructive">{notesError}</p>}
                  {form.notes.length > 1500 && <p className="text-right text-micro text-muted-foreground">{form.notes.length} / 2000</p>}
                </FormSection>
              </>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </Drawer>
  );
}

const formatDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The record as text for anyone who can't edit it — disabled inputs with leftover placeholders read as a broken form. */
function ReadOnlyDetails({ supplier }: { supplier: Supplier }) {
  const rows: { icon: IconComponent; label: string; value?: string | null; href?: string }[] = [
    { icon: MapPin, label: 'Address', value: supplier.address },
    { icon: UserRound, label: 'Contact person', value: supplier.contactName },
    { icon: Mail, label: 'Email', value: supplier.email, href: supplier.email ? `mailto:${supplier.email}` : undefined },
    {
      icon: Phone,
      label: 'Phone',
      value: supplier.phone,
      href: supplier.phone ? `tel:${supplier.phone.replace(/[^\d+]/g, '')}` : undefined,
    },
    { icon: FileText, label: 'Notes', value: supplier.notes },
  ];
  return (
    <dl className="overflow-hidden rounded-lg border border-rule/60 bg-card">
      {rows.map(({ icon: Icon, label, value, href }) => (
        <div key={label} className="flex items-start gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground" aria-hidden="true">
            <Icon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                'whitespace-pre-line break-words text-sm',
                value ? 'font-semibold text-foreground' : 'text-muted-foreground/70',
              )}
            >
              {value && href ? (
                <a href={href} className="hover:underline">
                  {value}
                </a>
              ) : (
                value || 'Not given'
              )}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

/** What deactivating does and doesn't do — the question a manager has before confirming. */
function DeactivateConsequences({ name }: { name: string }) {
  const rows: { icon: IconComponent; title: string; detail: string; tone: 'stop' | 'keep' }[] = [
    {
      icon: Ban,
      title: 'Can’t be picked for new orders',
      detail: `${name} leaves the supplier list on new purchase orders.`,
      tone: 'stop',
    },
    {
      icon: FileText,
      title: 'Past orders keep it',
      detail: 'Orders already raised — sent, received or drafts — still show this supplier.',
      tone: 'keep',
    },
    {
      icon: RotateCcw,
      title: 'Reactivate any time',
      detail: 'Nothing is deleted. Contact details and notes stay on the record.',
      tone: 'keep',
    },
  ];
  return (
    <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
      {rows.map(({ icon: Icon, title, detail, tone }) => (
        <li key={title} className="flex items-start gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              tone === 'stop' ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary',
            )}
            aria-hidden="true"
          >
            <Icon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{title}</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The supplier's card as the grid will show it, updating as you type. */
function CardPreview({ form, status }: { form: SupplierForm; status?: 'active' | 'inactive' | 'leaving' }) {
  const muted = status === 'inactive';
  const initials = supplierInitials(form.name);
  const reach = [form.email.trim(), form.phone.trim()].filter(Boolean);
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4',
        muted ? 'border-rule/50 bg-band/60' : status === 'leaving' ? 'border-exception/30 bg-card' : 'border-rule/60 bg-card shadow-sm',
      )}
      aria-label="Card preview"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full border-[16px] border-primary/[0.04]"
      />
      <div className="relative flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
            muted ? 'bg-field text-muted-foreground' : 'bg-primary text-primary-foreground',
          )}
        >
          {initials || <Truck size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-base font-semibold tracking-title',
              !form.name.trim() ? 'text-muted-foreground/70' : muted ? 'text-foreground/60' : 'text-foreground',
            )}
          >
            {form.name.trim() || 'Supplier name'}
          </p>
          <p className="truncate text-xs text-muted-foreground">{[form.contactName.trim() || 'No contact person', ...reach].join(' · ')}</p>
        </div>
        {status && (
          <span
            className={cn(
              'shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold',
              status === 'active' && 'bg-success/10 text-success',
              status === 'inactive' && 'bg-field text-muted-foreground',
              status === 'leaving' && 'bg-exception/8 text-exception',
            )}
          >
            {status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : 'Deactivating'}
          </span>
        )}
      </div>
    </div>
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
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'suppliers:write');
  const canDelete = hasCapability(capabilities, 'suppliers:delete');
  const [view, setView] = useState<SupplierView>('active');
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);

  const active = suppliers.filter((supplier) => supplier.isActive);
  const inactive = suppliers.length - active.length;
  const shown = useMemo(() => filterSuppliers(suppliers, view, search), [suppliers, view, search]);
  const counts: Record<SupplierView, number> = { active: active.length, inactive, all: suppliers.length };

  return (
    <motion.div className="space-y-4" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1 lg:max-w-xs">
          <Input
            placeholder="Find a supplier"
            aria-label="Find a supplier"
            leftIcon={<Search size={14} />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-rule"
            rightAction={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              ) : undefined
            }
          />
        </div>
        <Select
          value={view}
          onValueChange={(value) => setView(value as SupplierView)}
          ariaLabel="Status"
          options={[
            { value: 'active', label: `Active · ${counts.active}` },
            { value: 'inactive', label: `Inactive · ${counts.inactive}` },
            { value: 'all', label: `All suppliers · ${counts.all}` },
          ]}
          className="w-48"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {shown.length} {shown.length === 1 ? 'supplier' : 'suppliers'}
        </span>
      </motion.div>

      <motion.section variants={SECTION_RISE} aria-label="Suppliers">
        {shown.length === 0 && !(canWrite && suppliers.length === 0) ? (
          <EmptyState
            icon={Truck}
            title={suppliers.length === 0 ? 'No suppliers yet' : 'Nothing matches'}
            description={suppliers.length === 0 ? 'Suppliers you buy from appear here.' : 'Try another search or status.'}
            kind={suppliers.length === 0 ? 'start' : 'search'}
            action={
              suppliers.length === 0
                ? undefined
                : {
                    label: 'Clear filters',
                    onClick: () => {
                      setSearch('');
                      setView('all');
                    },
                  }
            }
          />
        ) : (
          // No card around the suppliers: they are cards already, like the readers in Settings.
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((supplier, index) => (
              <SupplierCard key={supplier.id} supplier={supplier} index={index} onOpen={() => setEditTarget(supplier)} />
            ))}
            {canWrite && !search && view !== 'inactive' && (
              <li>
                {/* The same card shape, dashed: where the next supplier will go. */}
                <button
                  type="button"
                  onClick={() => onCreateOpenChange(true)}
                  className="flex aspect-[1.75] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rule/70 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-band">
                    <Plus size={20} aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold">{suppliers.length === 0 ? 'Add your first supplier' : 'Add supplier'}</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </motion.section>

      {createOpen && <SupplierDrawer canWrite={canWrite} canDelete={canDelete} onClose={() => onCreateOpenChange(false)} />}
      {editTarget && (
        <SupplierDrawer
          key={editTarget.id}
          supplier={editTarget}
          canWrite={canWrite}
          canDelete={canDelete}
          onClose={() => setEditTarget(null)}
        />
      )}
    </motion.div>
  );
}

/** One supplier as a business card: who, the person to ask for, how to reach them — and one tap to email or call. */
function SupplierCard({ supplier, index, onOpen }: { supplier: Supplier; index: number; onOpen: () => void }) {
  const reduceMotion = useReducedMotion();
  const missing = missingDetails(supplier);
  const cantReach = unreachable(supplier);
  const active = supplier.isActive;
  const initials = supplierInitials(supplier.name);

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index, 8) * 0.04, duration: 0.3 }}
      className={cn(
        'group relative flex aspect-[1.75] flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-[border-color,box-shadow]',
        active ? 'border-rule/60 bg-card shadow-sm hover:border-primary/40 hover:shadow-md' : 'border-rule/50 bg-band/60',
      )}
    >
      {/* Two faint rings, like the readers' cards in Settings. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full border-[18px] border-primary/[0.04]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -right-2 size-40 rounded-full border-[14px] border-primary/[0.03]"
      />

      {/* The whole card opens the record; the email and call links sit above it. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${supplier.name}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />

      <div className="pointer-events-none relative flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
            active ? 'bg-primary text-primary-foreground' : 'bg-field text-muted-foreground',
          )}
        >
          {initials || <Truck size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-base font-semibold tracking-title', active ? 'text-foreground' : 'text-foreground/60')}>
            {supplier.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {supplier.contactName || 'No contact person'}
            {/* When you last ordered is the better scan cue for "who do we actually use". */}
            {supplier.summary?.lastOrderedAt && (
              <>
                {' · ordered '}
                <RelativeTime iso={supplier.summary.lastOrderedAt} />
              </>
            )}
          </span>
        </span>
        {/* A word, not an icon: the whole card is one button underneath, so a
            hover tooltip could never open. What is missing shows either way —
            the lines below only name it to screen readers. */}
        {!active && (
          <Pill tone="muted" icon={Ban}>
            Inactive
          </Pill>
        )}
        {missing.length > 0 ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-sm bg-measured/10 px-1.5 py-0.5 text-micro font-semibold text-measured"
            title={`Missing ${missing.join(', ')}`}
          >
            <AlertTriangle size={11} aria-hidden="true" />
            {cantReach ? 'Can’t reach' : 'Incomplete'}
          </span>
        ) : null}
      </div>

      <div className="relative flex items-end justify-between gap-3">
        <dl className="pointer-events-none min-w-0 space-y-1 text-xs">
          <CardLine icon={Mail} value={supplier.email} empty="No email" />
          <CardLine icon={Phone} value={supplier.phone} empty="No phone" />
          <CardLine icon={MapPin} value={supplier.address} empty="No address" />
        </dl>
        {/* Reach them without opening the record — the call you make when a delivery is late. */}
        <span className="relative z-10 flex shrink-0 items-center gap-1">
          {supplier.email && (
            <Button asChild variant="outline" size="icon-sm" title={`Email ${supplier.email}`}>
              <a href={`mailto:${supplier.email}`} aria-label={`Email ${supplier.name}`}>
                <Mail />
              </a>
            </Button>
          )}
          {supplier.phone && (
            <Button asChild variant="outline" size="icon-sm" title={`Call ${supplier.phone}`}>
              <a href={`tel:${supplier.phone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${supplier.name}`}>
                <Phone />
              </a>
            </Button>
          )}
        </span>
      </div>
    </motion.li>
  );
}

/** A way to reach them; a missing one is its icon alone, dimmed — the "Incomplete" chip already says what's missing. */
function CardLine({ icon: Icon, value, empty }: { icon: typeof Mail; value?: string | null; empty: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className={cn('shrink-0', value ? 'text-muted-foreground' : 'text-muted-foreground/40')}>
        <Icon size={12} aria-hidden="true" />
        <span className="sr-only">{empty.replace('No ', '')}</span>
      </dt>
      <dd className={cn('truncate', value ? 'text-foreground/80' : 'sr-only')}>{value || empty}</dd>
    </div>
  );
}
