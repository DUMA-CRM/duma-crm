'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Banknote, Building2, HeartHandshake, Landmark, Loader2, UserRound } from '@/components/icons';
import { usePayrollSettings } from '@/components/payroll/usePayroll';
import { AddressFields } from '@/components/people/AddressFields';
import { EMPLOYMENT_CONFIG, EMPLOYMENT_TYPES, PAY_CONFIG, PAY_TYPES, lbl } from '@/components/people/shared';
import { Drawer } from '@/components/shared/Drawer';
import { FormSection } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { type UpdateEmployeePayload, setEmployeeBank, updateEmployee } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { statutoryIdLabel } from '@/lib/utils/employee-record';
import {
  formatNiNumber,
  formatSortCode,
  isValidAccountNumber,
  isValidNiNumber,
  isValidSortCode,
  normaliseAccountNumber,
  normaliseNiNumber,
  normaliseSortCode,
} from '@/lib/utils/my-hr';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

import { ChoiceCards, type Employee } from './shared';

/**
 * One way in to everything this record holds about a person.
 *
 * It replaces three in-place card editors. My HR made the same move and left
 * the reason in a comment: *"one way in, one drawer, instead of four buttons
 * that all open the same form."* The cards below are now read-only, which is
 * what lets them say "Missing" rather than render a form.
 *
 * **Access is deliberately not here.** Role, scope and locations are
 * `updateStaff`, not `updateEmployee` — a different resource, and a privilege
 * change. Sharing a Save button with a home-address correction is how someone
 * gets promoted by accident, so `AccessCard` keeps its own explicit edit.
 *
 * The validators are the ones My HR already uses, and `my-hr.test.mts` already
 * covers them — a sort code is a sort code whoever is typing it.
 */
export function EditDetailsDrawer({
  userId,
  employee,
  canEditPay,
  onClose,
}: {
  userId: string;
  employee: Employee;
  /** `hr.sensitive:write` — pay, NI and bank. Without it the drawer is details only. */
  canEditPay: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Country and currency come from payroll settings, readable with `hr.payroll:read`.
  const canReadPayroll = hasCapability(useAuthStore((state) => state.capabilities), 'hr.payroll:read');
  const { data: payroll } = usePayrollSettings(canReadPayroll);
  const country = payroll?.payrollCountry ?? null;
  const uk = !country || country === 'GB';
  const currency = payroll?.currency ?? 'GBP';
  const idLabel = statutoryIdLabel(country);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const blur = (key: string) => () => setTouched((current) => ({ ...current, [key]: true }));

  const [form, setForm] = useState({
    jobTitle: employee.jobTitle ?? '',
    department: employee.department ?? '',
    employmentType: employee.employmentType,
    dateOfBirth: employee.dateOfBirth?.slice(0, 10) ?? '',
    address: employee.address ?? '',
    emergencyContactName: employee.emergencyContactName ?? '',
    emergencyContactPhone: employee.emergencyContactPhone ?? '',
    emergencyContactRelation: employee.emergencyContactRelation ?? '',
    payType: employee.payType ?? 'hourly',
    hourlyRate: employee.hourlyRate ?? '',
    annualSalary: employee.annualSalary ?? '',
    taxCode: employee.taxCode ?? '',
    niNumber: '',
    accountHolder: '',
    bankName: '',
    sortCode: '',
    accountNumber: '',
  });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  // Bank details are all-or-nothing: a sort code with no account number cannot
  // be paid into, so a half-filled set blocks the save rather than storing a
  // fragment. Same rule My HR applies to the employee's own entry.
  //
  // The UK formats are checked as UK formats. Anywhere else the fields hold
  // the local equivalents, so only the API's own limits apply (bank code 10,
  // account 20, ID 13) — a PESEL or a Ukrainian account number is not wrong
  // for failing a sort-code rule.
  const bankTouched = !!(form.accountHolder || form.sortCode || form.accountNumber);
  const sortCodeValid = uk ? isValidSortCode(form.sortCode) : form.sortCode.trim().length > 0 && form.sortCode.trim().length <= 10;
  const accountValid = uk
    ? isValidAccountNumber(form.accountNumber)
    : form.accountNumber.replace(/\s/g, '').length > 0 && form.accountNumber.replace(/\s/g, '').length <= 20;
  const bankComplete = !!form.accountHolder.trim() && sortCodeValid && accountValid;
  const niValid = !form.niNumber || (uk ? isValidNiNumber(form.niNumber) : form.niNumber.trim().length <= 13);
  const canSave = (!bankTouched || bankComplete) && niValid && form.jobTitle.trim() !== '';

  const save = useMutation({
    mutationFn: async () => {
      const payload: UpdateEmployeePayload = {
        jobTitle: form.jobTitle.trim(),
        department: form.department.trim() || undefined,
        employmentType: form.employmentType,
        dateOfBirth: form.dateOfBirth || null,
        address: form.address || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        emergencyContactRelation: form.emergencyContactRelation || null,
      };
      if (canEditPay) {
        payload.payType = form.payType;
        payload.hourlyRate = form.payType === 'hourly' ? Number(form.hourlyRate) || 0 : null;
        payload.annualSalary = form.payType === 'salaried' ? Number(form.annualSalary) || 0 : null;
        payload.taxCode = form.taxCode.trim() || null;
        if (form.niNumber) payload.niNumber = uk ? normaliseNiNumber(form.niNumber) : form.niNumber.trim();
      }
      await updateEmployee(userId, payload);

      // A second call, and only when something was actually typed: the bank
      // endpoint is separately gated and separately audited.
      if (canEditPay && bankTouched) {
        await setEmployeeBank(userId, {
          accountHolder: form.accountHolder.trim(),
          bankName: form.bankName.trim() || null,
          sortCode: uk ? normaliseSortCode(form.sortCode) : form.sortCode.trim(),
          accountNumber: uk ? normaliseAccountNumber(form.accountNumber) : form.accountNumber.replace(/\s/g, ''),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employee', userId) });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employees') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('employee-bank', userId) });
      toast('success', 'Employee record updated.');
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The record wasn’t updated. Review the fields and try again.'),
  });

  return (
    <Drawer
      title="Edit details"
      description="Their employment record. Access and sign-in are changed on the record itself."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button size="lg" className="flex-1" onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save changes
          </Button>
        </div>
      }
    >
      <div className="space-y-7">
        <FormSection icon={Building2} title="Employment">
          <Field label="Job title">
            <Input value={form.jobTitle} onChange={set('jobTitle')} aria-invalid={!form.jobTitle.trim()} />
            {!form.jobTitle.trim() && <p className="mt-1 text-xs font-semibold text-destructive">A job title is needed.</p>}
          </Field>
          <Field label="Department">
            <Input value={form.department} onChange={set('department')} placeholder="e.g. Front of house" />
          </Field>
          <Field label="Contract">
            <ChoiceCards
              value={form.employmentType}
              onChange={(employmentType) => setForm({ ...form, employmentType })}
              options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: EMPLOYMENT_CONFIG[type].label }))}
            />
          </Field>
        </FormSection>

        <FormSection icon={UserRound} title="Personal">
          <DatePicker
            label="Date of birth"
            value={form.dateOfBirth}
            onValueChange={(dateOfBirth) => setForm({ ...form, dateOfBirth })}
            max={new Date().toISOString().slice(0, 10)}
          />
          {/* Labels its own four inputs, so no wrapping label. */}
          <AddressFields value={form.address} onChange={(address) => setForm({ ...form, address })} />
        </FormSection>

        <FormSection icon={HeartHandshake} title="Emergency contact" note="Who to call if something happens at work.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={form.emergencyContactName} onChange={set('emergencyContactName')} />
            </Field>
            <Field label="Relationship">
              <Input value={form.emergencyContactRelation} onChange={set('emergencyContactRelation')} placeholder="e.g. Partner" />
            </Field>
          </div>
          <Field label="Phone">
            <Input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
          </Field>
        </FormSection>

        {canEditPay && (
          <>
            <FormSection icon={Banknote} title="Pay" note={`Amounts in ${currency}. Nothing here is calculated — payroll uses what you enter.`}>
              <Field label="Pay basis">
                <ChoiceCards
                  value={form.payType}
                  onChange={(payType) => setForm({ ...form, payType })}
                  options={PAY_TYPES.map((type) => ({ value: type, label: PAY_CONFIG[type].label }))}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                {form.payType === 'hourly' ? (
                  <Field label={`Hourly rate (${currency})`}>
                    <Input inputMode="decimal" value={String(form.hourlyRate ?? '')} onChange={set('hourlyRate')} placeholder="0.00" />
                  </Field>
                ) : (
                  <Field label={`Annual salary (${currency})`}>
                    <Input inputMode="decimal" value={String(form.annualSalary ?? '')} onChange={set('annualSalary')} placeholder="0.00" />
                  </Field>
                )}
                <Field label="Tax code">
                  <Input value={form.taxCode} onChange={set('taxCode')} placeholder={uk ? '1257L' : 'If your payroll uses one'} />
                </Field>
              </div>
              <Field label={idLabel}>
                <Input
                  value={uk ? formatNiNumber(form.niNumber) : form.niNumber}
                  onChange={set('niNumber')}
                  onBlur={blur('niNumber')}
                  maxLength={uk ? undefined : 13}
                  placeholder={employee.hasNiNumber ? 'On file — type to replace' : uk ? 'AB 12 34 56 C' : ''}
                />
                {touched.niNumber && !niValid && (
                  <p className="mt-1 text-xs font-semibold text-destructive">
                    {uk ? 'Two letters, six digits, then a letter A–D.' : 'Up to 13 characters.'}
                  </p>
                )}
              </Field>
            </FormSection>

            <FormSection icon={Landmark} title="Bank details" note="Leave blank to keep what’s on file. Entering any of these replaces all of them.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Account holder">
                  <Input value={form.accountHolder} onChange={set('accountHolder')} />
                </Field>
                <Field label="Bank name">
                  <Input value={form.bankName} onChange={set('bankName')} />
                </Field>
                <Field label={uk ? 'Sort code' : 'Bank code'}>
                  <Input
                    value={uk ? formatSortCode(form.sortCode) : form.sortCode}
                    onChange={set('sortCode')}
                    onBlur={blur('sortCode')}
                    maxLength={uk ? undefined : 10}
                    placeholder={uk ? '04-00-04' : ''}
                  />
                  {touched.sortCode && form.sortCode && !sortCodeValid && (
                    <p className="mt-1 text-xs font-semibold text-destructive">{uk ? 'Six digits, e.g. 04-00-04.' : 'Up to 10 characters.'}</p>
                  )}
                </Field>
                <Field label="Account number">
                  <Input
                    value={form.accountNumber}
                    onChange={set('accountNumber')}
                    onBlur={blur('accountNumber')}
                    maxLength={uk ? undefined : 20}
                    placeholder={uk ? '12345678' : ''}
                  />
                  {touched.accountNumber && form.accountNumber && !accountValid && (
                    <p className="mt-1 text-xs font-semibold text-destructive">{uk ? 'Eight digits.' : 'Up to 20 characters.'}</p>
                  )}
                </Field>
              </div>
              {bankTouched && !bankComplete && (
                <p className="rounded-md bg-measured/10 px-3 py-2 text-xs text-measured">
                  An account holder, {uk ? 'sort code' : 'bank code'} and account number are all needed — a partial set can’t be paid into.
                </p>
              )}
            </FormSection>
          </>
        )}
      </div>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      {children}
    </div>
  );
}
