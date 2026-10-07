'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { AlertTriangle, ArrowLeft, Loader2, QrCode, Search, UserPlus, X } from '@/components/icons';
import { ScanCustomer } from '@/components/pos/ScanCustomer';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/modules/core/client';
import { createCustomer, getCustomers } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { guessNewCustomer, newCustomerErrors } from '@/lib/utils/pos';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Customer } from '@/types/customers';

export type CustomerView = 'find' | 'new' | 'scan';

/**
 * Attaching a customer takes over the ticket panel, like the item customiser:
 * one big search (name, phone or email — the API matches all three), scanning
 * their loyalty code, or creating them, pre-filled from what was searched.
 */
export function CustomerAttach({
  initialView,
  current,
  onSelect,
  onRemove,
  onClose,
}: {
  initialView: CustomerView;
  /** The customer already on the ticket — shown first, with Remove. */
  current?: Customer | null;
  onSelect: (customer: Customer) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<CustomerView>(initialView);
  const [query, setQuery] = useState('');

  const title = { find: 'Add customer', new: 'New customer', scan: 'Scan loyalty code' }[view];
  const back = view === 'find' || initialView === view ? onClose : () => setView('find');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-rule/60 px-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={back}
          aria-label={view === 'find' || initialView === view ? 'Back to the ticket' : 'Back to search'}
          className="size-12"
        >
          <ArrowLeft size={20} />
        </Button>
        <p className="text-lg font-semibold text-foreground">{title}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {view === 'find' && current && (
          <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
            <InitialsAvatar firstName={current.firstName} lastName={current.lastName} email={current.email} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-foreground">
                {current.firstName} {current.lastName}
              </span>
              <span className="block text-sm text-muted-foreground">
                On this ticket · {(current.pointsBalance ?? 0).toLocaleString()} pts
              </span>
            </span>
            {onRemove && (
              <Button variant="outline" onClick={onRemove} className="h-11 shrink-0 text-destructive hover:text-destructive">
                Remove
              </Button>
            )}
          </div>
        )}
        {view === 'find' && (
          <FindCustomer query={query} onQuery={setQuery} onSelect={onSelect} onNew={() => setView('new')} onScan={() => setView('scan')} />
        )}
        {view === 'new' && (
          <NewCustomer
            initial={guessNewCustomer(query)}
            onCreated={onSelect}
            onFindExisting={(phone) => {
              setQuery(phone);
              setView('find');
            }}
          />
        )}
        {view === 'scan' && <ScanCustomer onSelect={onSelect} onSearchInstead={() => setView('find')} />}
      </div>
    </div>
  );
}

// ── Find ─────────────────────────────────────────────────────────────────────

function FindCustomer({
  query,
  onQuery,
  onSelect,
  onNew,
  onScan,
}: {
  query: string;
  onQuery: (q: string) => void;
  onSelect: (c: Customer) => void;
  onNew: () => void;
  onScan: () => void;
}) {
  // Wait for a pause in typing so every keystroke isn't a request.
  const [term, setTerm] = useState(query.trim());
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const enough = term.length >= 2;

  const search = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-phone-search', term),
    queryFn: () => getCustomers({ search: term, limit: 8 }),
    enabled: enough,
    staleTime: 10_000,
  });
  const results = search.data?.data ?? [];

  return (
    <div className="space-y-4 p-4">
      <div className="relative">
        <Search
          size={20}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Name, phone or email"
          aria-label="Find a customer by name, phone or email"
          enterKeyHint="search"
          autoComplete="off"
          className="h-14 w-full rounded-xl border border-input bg-control pl-12 pr-12 text-lg text-foreground outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured [&::-webkit-search-cancel-button]:hidden"
        />
        {search.isFetching ? (
          <Loader2 size={18} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          query && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onQuery('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 size-12 -translate-y-1/2 text-muted-foreground"
            >
              <X size={18} />
            </Button>
          )
        )}
      </div>

      {!enough ? (
        <div className="grid gap-3">
          <BigAction icon={QrCode} title="Scan loyalty code" description="From the customer’s app or card." onClick={onScan} />
          <BigAction icon={UserPlus} title="New customer" description="Name and phone — takes a few seconds." onClick={onNew} />
        </div>
      ) : search.isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-exception/35 bg-destructive/6 px-4 py-3 text-sm text-foreground"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={17} aria-hidden="true" className="text-destructive" /> The search didn’t work.
          </span>
          <Button variant="outline" onClick={() => void search.refetch()} className="h-11">
            Try again
          </Button>
        </div>
      ) : search.isLoading ? (
        <ListSkeleton rows={3} avatar label="Searching customers" className="rounded-xl" />
      ) : (
        <>
          {results.length > 0 && (
            <ul className="divide-y divide-rule/45 overflow-hidden rounded-xl border border-rule/60 bg-card">
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(customer)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-band"
                  >
                    <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} email={customer.email} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-foreground">
                        {customer.firstName} {customer.lastName}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span data-figure className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {(customer.pointsBalance ?? 0).toLocaleString()} pts
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.length === 0 && (
            <p className="px-1 text-center text-sm text-muted-foreground">
              No customer matches <span className="font-medium text-foreground">“{term}”</span>.
            </p>
          )}
          <BigAction
            icon={UserPlus}
            title={results.length === 0 ? `Create “${term}”` : 'Someone else? New customer'}
            description={results.length === 0 ? 'Add them as a new customer.' : 'Add a customer who isn’t listed.'}
            onClick={onNew}
            dashed
          />
        </>
      )}
    </div>
  );
}

function BigAction({
  icon: Icon,
  title,
  description,
  onClick,
  dashed = false,
}: {
  icon: typeof QrCode;
  title: string;
  description: string;
  onClick: () => void;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-20 w-full touch-manipulation items-center gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-transform duration-100 active:scale-[0.99]',
        dashed ? 'border-dashed border-rule' : 'border-rule/70',
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary" aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

// ── New ──────────────────────────────────────────────────────────────────────

function NewCustomer({
  initial,
  onCreated,
  onFindExisting,
}: {
  initial: ReturnType<typeof guessNewCustomer>;
  onCreated: (c: Customer) => void;
  onFindExisting: (phone: string) => void;
}) {
  const { tenantId } = useWorkspaceStore();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const [tried, setTried] = useState(false);
  const errors = newCustomerErrors(form);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  const create = useMutation({
    mutationFn: () =>
      createCustomer({
        tenantId: tenantId!,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
      }),
    onSuccess: (customer) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customers') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-phone-search') });
      onCreated(customer);
    },
  });
  const duplicate = create.error instanceof ApiError && create.error.status === 409;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (Object.keys(errors).length === 0 && tenantId) create.mutate();
      }}
      className="space-y-4 p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={tried ? errors.firstName : undefined}>
          <input
            autoFocus={!initial.firstName}
            value={form.firstName}
            onChange={set('firstName')}
            autoComplete="off"
            maxLength={100}
            className={fieldClass(tried && !!errors.firstName)}
          />
        </Field>
        <Field label="Last name" error={tried ? errors.lastName : undefined}>
          <input
            autoFocus={!!initial.firstName && !initial.lastName}
            value={form.lastName}
            onChange={set('lastName')}
            autoComplete="off"
            maxLength={100}
            className={fieldClass(tried && !!errors.lastName)}
          />
        </Field>
      </div>
      <Field label="Phone" error={tried ? errors.phone : undefined}>
        <input
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={set('phone')}
          autoComplete="off"
          maxLength={30}
          placeholder="+44 7911 123456"
          className={fieldClass(tried && !!errors.phone)}
        />
      </Field>
      <Field label="Email" hint="Optional — for receipts and offers they sign up to." error={tried ? errors.email : undefined}>
        <input
          type="email"
          inputMode="email"
          value={form.email}
          onChange={set('email')}
          autoComplete="off"
          className={fieldClass(tried && !!errors.email)}
        />
      </Field>

      {create.isError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-exception/35 bg-destructive/6 px-4 py-3 text-sm text-foreground"
        >
          <span>{duplicate ? 'There’s already a customer with this phone number.' : 'The customer wasn’t created. Try again.'}</span>
          {duplicate && (
            <Button type="button" variant="outline" onClick={() => onFindExisting(form.phone.trim())} className="h-11 shrink-0">
              Find them
            </Button>
          )}
        </div>
      )}

      <Button type="submit" disabled={create.isPending || !tenantId} className="h-14 w-full text-base">
        {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
        {create.isPending ? 'Adding…' : 'Create and add to ticket'}
      </Button>
    </form>
  );
}

const fieldClass = (invalid: boolean) =>
  cn(
    'h-12 w-full rounded-lg border bg-field px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:outline-2',
    invalid ? 'border-exception focus:outline-exception' : 'border-input focus:border-measured focus:outline-measured',
  );

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-label uppercase text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-exception">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
