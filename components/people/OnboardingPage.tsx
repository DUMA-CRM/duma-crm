'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { AddressFields } from '@/components/people/AddressFields';
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_CONFIG,
  PAY_TYPES,
  PAY_CONFIG,
  ROLE_CONFIG,
  SCOPES,
  inp,
  lbl,
  sel,
} from '@/components/people/shared';
import { Button } from '@/components/ui/button';

import { type OnboardPayload, onboardEmployee } from '@/lib/api/onboarding.service';
import type { StaffRole } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Roles selectable when onboarding (super_admin is never assigned this way).
const ONBOARD_ROLES: Exclude<StaffRole, 'super_admin'>[] = [
  'franchise_owner',
  'store_manager',
  'barista',
  'hr_manager',
  'marketing_manager',
  'auditor',
];

const STEPS = ['Account & role', 'Personal', 'Employment & pay', 'Bank & statutory'] as const;

type Form = Partial<OnboardPayload> & {
  email: string;
  name: string;
  password: string;
  role: Exclude<StaffRole, 'super_admin'>;
  scope: OnboardPayload['scope'];
  locationIds: string[];
  jobTitle: string;
  employmentType: OnboardPayload['employmentType'];
  startDate: string;
  payType: OnboardPayload['payType'];
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export function OnboardingPage({ onClose, onCreated }: { onClose: () => void; onCreated: (userId: string) => void }) {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>({
    email: '',
    name: '',
    password: '',
    role: 'barista',
    scope: 'location',
    locationIds: [],
    jobTitle: '',
    employmentType: 'part_time',
    startDate: todayISO(),
    payType: 'hourly',
    unpaidBreakMins: 30,
    breakThresholdMins: 360,
  });
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));

  const create = useMutation({
    mutationFn: () => {
      const payload: OnboardPayload = {
        ...f,
        locationIds: f.scope === 'location' ? f.locationIds : undefined,
        hourlyRate: f.payType === 'hourly' ? (f.hourlyRate ?? 0) : undefined,
        annualSalary: f.payType === 'salaried' ? (f.annualSalary ?? 0) : undefined,
      };
      return onboardEmployee(payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('success', `${f.name} onboarded.`);
      onCreated(res.userId);
    },
    onError: (err) => toast('error', (err as Error).message || 'Could not onboard the employee.'),
  });

  // Per-step validity gates the Next/Finish button.
  const stepValid = [
    f.email.includes('@') && f.name.trim().length >= 2 && f.password.length >= 8 && (f.scope !== 'location' || f.locationIds.length > 0),
    true, // personal is all optional
    f.jobTitle.trim().length > 0 &&
      !!f.startDate &&
      (f.payType === 'hourly' ? Number(f.hourlyRate) > 0 : Number(f.annualSalary) > 0),
    true, // bank/statutory optional
  ];
  const canAdvance = stepValid[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cancel onboarding" className="size-11 shrink-0">
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Onboarding</p>
            <h1 className="text-lg font-semibold text-foreground truncate">{f.name.trim() || 'New employee'}</h1>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-4 md:px-8 py-3 border-b border-border shrink-0 overflow-x-auto">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            disabled={i > step}
            className={cn(
              'flex items-center gap-2 px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
              i === step ? 'bg-primary/10 text-primary' : i < step ? 'text-foreground' : 'text-muted-foreground/50',
            )}
          >
            <span
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                i === step ? 'bg-primary text-white' : i < step ? 'bg-success text-white' : 'bg-muted',
              )}
            >
              {i < step ? <Check size={12} /> : i + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-4">
          {step === 0 && (
            <>
              <Field label="Full name">
                <input className={inp} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Jane Doe" autoFocus />
              </Field>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Email">
                  <input className={inp} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="jane@cafe.co.uk" />
                </Field>
                <Field label="Temporary password" hint="At least 8 characters; they can change it later.">
                  <input className={inp} type="text" value={f.password} onChange={(e) => set({ password: e.target.value })} placeholder="••••••••" />
                </Field>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Role">
                  <select className={sel} value={f.role} onChange={(e) => set({ role: e.target.value as Form['role'] })}>
                    {ONBOARD_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_CONFIG[r].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Scope">
                  <select className={sel} value={f.scope} onChange={(e) => set({ scope: e.target.value as Form['scope'] })}>
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {f.scope === 'location' && (
                <Field label="Locations" hint="Which sites this person can access.">
                  <div className="flex flex-wrap gap-1.5">
                    {locations.map((l) => {
                      const on = f.locationIds.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => set({ locationIds: on ? f.locationIds.filter((x) => x !== l.id) : [...f.locationIds, l.id] })}
                          className={cn(
                            'px-3 h-9 rounded-lg border text-xs font-medium transition-colors',
                            on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Date of birth">
                  <input className={inp} type="date" value={f.dateOfBirth ?? ''} onChange={(e) => set({ dateOfBirth: e.target.value })} />
                </Field>
              </div>
              <div>
                <label className={lbl}>Home address</label>
                <AddressFields value={f.address ?? ''} onChange={(v) => set({ address: v })} />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-2">Emergency contact</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Name">
                  <input className={inp} value={f.emergencyContactName ?? ''} onChange={(e) => set({ emergencyContactName: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <input className={inp} value={f.emergencyContactPhone ?? ''} onChange={(e) => set({ emergencyContactPhone: e.target.value })} />
                </Field>
                <Field label="Relationship">
                  <input className={inp} value={f.emergencyContactRelation ?? ''} onChange={(e) => set({ emergencyContactRelation: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Job title">
                  <input className={inp} value={f.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} placeholder="Barista" autoFocus />
                </Field>
                <Field label="Department">
                  <input className={inp} value={f.department ?? ''} onChange={(e) => set({ department: e.target.value })} placeholder="Front of house" />
                </Field>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Employment type">
                  <select className={sel} value={f.employmentType} onChange={(e) => set({ employmentType: e.target.value as Form['employmentType'] })}>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EMPLOYMENT_CONFIG[t].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Start date">
                  <input className={inp} type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
                </Field>
              </div>

              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-2">Pay</p>
              <div className="flex gap-1.5">
                {PAY_TYPES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set({ payType: p })}
                    className={cn(
                      'flex-1 h-10 rounded-lg border text-sm font-medium transition-colors',
                      f.payType === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {PAY_CONFIG[p].label}
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {f.payType === 'hourly' ? (
                  <Field label="Hourly rate (£)">
                    <input className={inp} inputMode="decimal" value={f.hourlyRate ?? ''} onChange={(e) => set({ hourlyRate: Number(e.target.value) })} placeholder="12.50" />
                  </Field>
                ) : (
                  <Field label="Annual salary (£)">
                    <input className={inp} inputMode="decimal" value={f.annualSalary ?? ''} onChange={(e) => set({ annualSalary: Number(e.target.value) })} placeholder="26000" />
                  </Field>
                )}
                <Field label="Unpaid break (mins)">
                  <input className={inp} inputMode="numeric" value={f.unpaidBreakMins ?? 0} onChange={(e) => set({ unpaidBreakMins: Number(e.target.value) })} />
                </Field>
                <Field label="Break after (mins)" hint="Break applies to shifts longer than this.">
                  <input className={inp} inputMode="numeric" value={f.breakThresholdMins ?? 0} onChange={(e) => set({ breakThresholdMins: Number(e.target.value) })} />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">UK statutory</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="National Insurance no." hint="Encrypted; visible only to HR/owners.">
                  <input className={inp} value={f.niNumber ?? ''} onChange={(e) => set({ niNumber: e.target.value.toUpperCase() })} placeholder="QQ 12 34 56 C" />
                </Field>
                <Field label="Tax code">
                  <input className={inp} value={f.taxCode ?? ''} onChange={(e) => set({ taxCode: e.target.value.toUpperCase() })} placeholder="1257L" />
                </Field>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-2">Bank account (UK)</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Account holder">
                  <input className={inp} value={f.accountHolder ?? ''} onChange={(e) => set({ accountHolder: e.target.value })} />
                </Field>
                <Field label="Bank name">
                  <input className={inp} value={f.bankName ?? ''} onChange={(e) => set({ bankName: e.target.value })} />
                </Field>
                <Field label="Sort code" hint="Encrypted at rest.">
                  <input className={inp} value={f.sortCode ?? ''} onChange={(e) => set({ sortCode: e.target.value })} placeholder="12-34-56" />
                </Field>
                <Field label="Account number" hint="Encrypted at rest.">
                  <input className={inp} value={f.accountNumber ?? ''} onChange={(e) => set({ accountNumber: e.target.value })} placeholder="12345678" />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">Statutory and bank details are optional here — you can add them later on the employee record.</p>
            </>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3.5 border-t border-border shrink-0 bg-card">
        <Button variant="outline" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} className="h-11">
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {isLast ? (
          <Button onClick={() => create.mutate()} disabled={!canAdvance || create.isPending} className="h-11 px-6 gap-2">
            {create.isPending && <Loader2 size={15} className="animate-spin" />}
            {create.isPending ? 'Onboarding…' : 'Finish & create'}
          </Button>
        ) : (
          <Button onClick={() => canAdvance && setStep(step + 1)} disabled={!canAdvance} className="h-11 px-6 gap-2">
            Next
            <ArrowRight size={15} />
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
