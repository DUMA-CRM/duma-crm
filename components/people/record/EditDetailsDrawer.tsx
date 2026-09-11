'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AddressFields } from '@/components/people/AddressFields';
import { EMPLOYMENT_CONFIG, EMPLOYMENT_TYPES, PAY_CONFIG, PAY_TYPES, lbl } from '@/components/people/shared';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type UpdateEmployeePayload, setEmployeeBank, updateEmployee } from '@/lib/api/hr.service';
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
import { toast } from '@/stores/toastStore';

import type { Employee } from './shared';

/**
 * One way in to everything this record holds about a person.
 *
 * It replaces three in-place card editors. My HR made the same move and left
 * the reason in a comment: *"one way in, one drawer, instead of four buttons
 * that all open the same form."* The cards below are now read-only, which is
 * what lets them use `InfoRow` and say "Missing" rather than render a form.
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
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  // Bank details are all-or-nothing: a sort code with no account number cannot
  // be paid into, so a half-filled set blocks the save rather than storing a
  // fragment. Same rule My HR applies to the employee's own entry.
  const bankTouched = !!(form.accountHolder || form.sortCode || form.accountNumber);
  const bankComplete = !!form.accountHolder.trim() && isValidSortCode(form.sortCode) && isValidAccountNumber(form.accountNumber);
  const niValid = !form.niNumber || isValidNiNumber(form.niNumber);
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
        if (form.niNumber) payload.niNumber = normaliseNiNumber(form.niNumber);
      }
      await updateEmployee(userId, payload);

      // A second call, and only when something was actually typed: the bank
      // endpoint is separately gated and separately audited.
      if (canEditPay && bankTouched) {
        await setEmployeeBank(userId, {
          accountHolder: form.accountHolder.trim(),
          bankName: form.bankName.trim() || null,
          sortCode: normaliseSortCode(form.sortCode),
          accountNumber: normaliseAccountNumber(form.accountNumber),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employee', userId] });
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      qc.invalidateQueries({ queryKey: ['employee-bank', userId] });
      toast('success', 'Employee record updated.');
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The record wasn’t updated. Review the fields and try again.'),
  });

  return (
    <Drawer
      title="Edit details"
      description={employee.jobTitle}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Section title="Employment">
          <div>
            <label className={lbl}>Job title</label>
            <Input value={form.jobTitle} onChange={set('jobTitle')} />
          </div>
          <div>
            <label className={lbl}>Department</label>
            <Input value={form.department} onChange={set('department')} />
          </div>
          <div>
            <label className={lbl}>Employment type</label>
            <Select
              value={form.employmentType}
              onValueChange={(value) => setForm({ ...form, employmentType: value as typeof form.employmentType })}
              options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: EMPLOYMENT_CONFIG[type].label }))}
              ariaLabel="Employment type"
            />
          </div>
        </Section>

        <Section title="Personal">
          <DatePicker
            label="Date of birth"
            value={form.dateOfBirth}
            onValueChange={(dateOfBirth) => setForm({ ...form, dateOfBirth })}
            max={new Date().toISOString().slice(0, 10)}
          />
          <div>
            <label className={lbl}>Home address</label>
            <AddressFields value={form.address} onChange={(address) => setForm({ ...form, address })} />
          </div>
        </Section>

        <Section title="Emergency contact">
          <div>
            <label className={lbl}>Name</label>
            <Input value={form.emergencyContactName} onChange={set('emergencyContactName')} />
          </div>
          <div>
            <label className={lbl}>Phone</label>
            <Input value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
          </div>
          <div>
            <label className={lbl}>Relationship</label>
            <Input value={form.emergencyContactRelation} onChange={set('emergencyContactRelation')} />
          </div>
        </Section>

        {canEditPay && (
          <>
            <Section title="Pay">
              <div>
                <label className={lbl}>Pay basis</label>
                <Select
                  value={form.payType}
                  onValueChange={(value) => setForm({ ...form, payType: value as typeof form.payType })}
                  options={PAY_TYPES.map((type) => ({ value: type, label: PAY_CONFIG[type].label }))}
                  ariaLabel="Pay basis"
                />
              </div>
              {form.payType === 'hourly' ? (
                <div>
                  <label className={lbl}>Hourly rate</label>
                  <Input inputMode="decimal" value={String(form.hourlyRate ?? '')} onChange={set('hourlyRate')} />
                </div>
              ) : (
                <div>
                  <label className={lbl}>Annual salary</label>
                  <Input inputMode="decimal" value={String(form.annualSalary ?? '')} onChange={set('annualSalary')} />
                </div>
              )}
              <div>
                <label className={lbl}>Tax code</label>
                <Input value={form.taxCode} onChange={set('taxCode')} />
              </div>
              <div>
                <label className={lbl}>National Insurance number</label>
                <Input
                  value={formatNiNumber(form.niNumber)}
                  onChange={set('niNumber')}
                  onBlur={blur('niNumber')}
                  placeholder={employee.hasNiNumber ? 'Held — type to replace' : 'AB 12 34 56 C'}
                />
                {touched.niNumber && !niValid && (
                  <p className="mt-1 text-xs font-semibold text-destructive">Two letters, six digits, then a letter A–D.</p>
                )}
              </div>
            </Section>

            <Section title="Bank details" note="Leave blank to keep what is on file. Entering any of these replaces all of them.">
              <div>
                <label className={lbl}>Account holder</label>
                <Input value={form.accountHolder} onChange={set('accountHolder')} />
              </div>
              <div>
                <label className={lbl}>Bank name</label>
                <Input value={form.bankName} onChange={set('bankName')} />
              </div>
              <div>
                <label className={lbl}>Sort code</label>
                <Input value={formatSortCode(form.sortCode)} onChange={set('sortCode')} onBlur={blur('sortCode')} placeholder="04-00-04" />
                {touched.sortCode && form.sortCode && !isValidSortCode(form.sortCode) && (
                  <p className="mt-1 text-xs font-semibold text-destructive">Six digits, e.g. 04-00-04.</p>
                )}
              </div>
              <div>
                <label className={lbl}>Account number</label>
                <Input value={form.accountNumber} onChange={set('accountNumber')} onBlur={blur('accountNumber')} placeholder="12345678" />
                {touched.accountNumber && form.accountNumber && !isValidAccountNumber(form.accountNumber) && (
                  <p className="mt-1 text-xs font-semibold text-destructive">Eight digits.</p>
                )}
              </div>
              {bankTouched && !bankComplete && (
                <p className="text-xs text-muted-foreground">
                  An account holder, sort code and account number are all needed — a partial set cannot be paid into.
                </p>
              )}
            </Section>
          </>
        )}
      </div>
    </Drawer>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}
