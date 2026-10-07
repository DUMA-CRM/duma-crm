'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Check, Loader2, Search, User, Users } from '@/components/icons';
import { type Choice, ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { Drawer } from '@/components/shared/Drawer';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type PrivacyRequestType, createPrivacyRequest } from '@/lib/modules/compliance/client';
import { getCustomers } from '@/lib/modules/customers/client';
import { getStaff } from '@/lib/modules/identity/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

import { CHANNELS, REQUEST_TYPES, TYPE_ORDER } from './privacyCopy';

const FORM_ID = 'record-privacy-request';

type Subject =
  | { kind: 'customer'; id: string; name: string; hint?: string }
  | { kind: 'employee'; id: string; name: string; hint?: string };

const TYPE_CHOICES: Choice<PrivacyRequestType>[] = TYPE_ORDER.map((value) => ({
  value,
  label: REQUEST_TYPES[value].label,
  detail: REQUEST_TYPES[value].detail,
  icon: REQUEST_TYPES[value].icon,
}));

/**
 * Recording a request, from the queue or from a person's record. From the
 * queue the first question is who asked — a customer found by search, or a
 * member of staff — so nobody has to leave the page to go and find them.
 */
export function RecordPrivacyRequest({
  tenantId,
  fixedSubject,
  onClose,
}: {
  tenantId?: string;
  /** Set on a person's own record, where there is no one to choose. */
  fixedSubject?: Subject;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState<Subject | null>(fixedSubject ?? null);
  const [type, setType] = useState<PrivacyRequestType | null>(null);
  const [channel, setChannel] = useState('in_person');
  const [details, setDetails] = useState('');

  // What the API will set: one calendar month from today.
  const [due] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  });

  const create = useMutation({
    mutationFn: () => {
      const common = { tenantId, type: type!, requestChannel: channel, details: details.trim() || undefined };
      return subject!.kind === 'employee'
        ? createPrivacyRequest({ ...common, subjectType: 'employee', employeeUserId: subject!.id })
        : createPrivacyRequest({ ...common, subjectType: 'customer', customerId: subject!.id });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.compliance.key('privacy-requests') });
      if (subject?.kind === 'customer')
        void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', subject.id) });
      toast('success', 'Request recorded — the one-month clock has started.');
      onClose();
    },
    onError: (error) => toast('error', error.message || 'The request wasn’t recorded. Check the details and try again.'),
  });

  const ready = !!subject && !!type && !create.isPending;

  return (
    <Drawer
      title="Record a privacy request"
      description="Note it the day it arrives — the deadline runs from then."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onClose} disabled={create.isPending} className="flex-1">
            Cancel
          </Button>
          <Button size="lg" type="submit" form={FORM_ID} disabled={!ready} className="flex-1">
            {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {create.isPending ? 'Recording…' : 'Record request'}
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) create.mutate();
        }}
      >
        {!fixedSubject && (
          <Question title="Who asked?">
            {subject ? (
              <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-field px-3.5 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Check size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{subject.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {subject.kind === 'employee' ? 'Staff member' : 'Customer'}
                    {subject.hint ? ` · ${subject.hint}` : ''}
                  </span>
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSubject(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <SubjectPicker tenantId={tenantId} onPick={setSubject} />
            )}
          </Question>
        )}

        <Question title="What are they asking for?">
          <ChoiceGrid<PrivacyRequestType> label="Request type" choices={TYPE_CHOICES} selected={type ? [type] : []} onChange={setType} />
        </Question>

        <Question title="How did it reach you?">
          <Select value={channel} onValueChange={setChannel} options={CHANNELS} ariaLabel="How it arrived" className="w-full" />
        </Question>

        <Question title="In their words" hint="Optional — what they asked for, as close to how they put it as you can.">
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={2000}
            rows={4}
            aria-label="Their request, in their words"
            placeholder="e.g. “Please delete my account and stop emailing me.”"
            className="w-full rounded-md border border-input bg-control p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30"
          />
        </Question>

        <p className="rounded-lg bg-band/60 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          The law gives you one month to respond, so this will be due on{' '}
          <span className="font-semibold text-foreground">{formatDate(due.toISOString())}</span>. It stays in the Compliance queue until
          it’s completed or declined.
        </p>
      </form>
    </Drawer>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** A customer by search, or a member of staff from the team list. */
function SubjectPicker({ tenantId, onPick }: { tenantId?: string; onPick: (subject: Subject) => void }) {
  const [kind, setKind] = useState<'customer' | 'employee'>('customer');
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());

  const customers = useQuery({
    queryKey: moduleQueryKeys.customers.key('privacy-subject-search', tenantId, term),
    queryFn: () => getCustomers({ tenantId, search: term, limit: 6 }),
    enabled: kind === 'customer' && term.length >= 2,
  });
  const staff = useQuery({
    queryKey: moduleQueryKeys.identity.key('staff', tenantId),
    queryFn: () => getStaff(tenantId),
    enabled: kind === 'employee' && !!tenantId,
  });

  const results: Subject[] =
    kind === 'customer'
      ? (customers.data?.data ?? []).map((customer) => ({
          kind: 'customer',
          id: customer.id,
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          hint: customer.email || customer.phone || undefined,
        }))
      : (staff.data ?? [])
          .filter((member) => !term || `${member.name ?? ''} ${member.email ?? ''}`.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 8)
          .map((member) => ({
            kind: 'employee',
            id: member.userId,
            name: member.name || member.email || 'Unnamed',
            hint: member.email ?? undefined,
          }));
  const loading = kind === 'customer' ? customers.isFetching : staff.isPending;
  const waiting = kind === 'customer' && term.length < 2;

  return (
    <div className="space-y-2.5">
      <SegmentedControl
        options={[
          { value: 'customer', label: 'A customer', icon: User },
          { value: 'employee', label: 'A member of staff', icon: Users },
        ]}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setSearch('');
        }}
        ariaLabel="Who asked"
      />
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={kind === 'customer' ? 'Search by name, email or phone…' : 'Search the team…'}
        aria-label={kind === 'customer' ? 'Search customers' : 'Search staff'}
        leftIcon={<Search size={14} />}
        autoFocus
      />
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
        {waiting ? (
          <p className="px-3.5 py-3 text-xs text-muted-foreground">Type at least two letters to search your customers.</p>
        ) : loading && results.length === 0 ? (
          <p className="flex items-center gap-2 px-3.5 py-3 text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Searching…
          </p>
        ) : results.length === 0 ? (
          <p className="px-3.5 py-3 text-xs text-muted-foreground">No one matches “{search}”.</p>
        ) : (
          <ul>
            {results.map((result) => (
              <li key={result.id} className="border-b border-rule/45 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onPick(result)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-band/60',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-band text-xs font-semibold text-muted-foreground">
                    {result.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{result.name}</span>
                    {result.hint && <span className="block truncate text-xs text-muted-foreground">{result.hint}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
