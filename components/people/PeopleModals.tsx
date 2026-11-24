'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { UsersRound } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { ModalActions } from '@/components/shared/FormParts';
import { DatePicker } from '@/components/ui/date-picker';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import {
  type StaffProfile,
} from '@/lib/modules/identity/client';
import {
  type CreateEmployeePayload,
  type EmploymentType,
  createEmployee,
} from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

import { Avatar, EMPLOYMENT_CONFIG, EMPLOYMENT_TYPES, inp, sel } from './shared';

// ── Enroll as employee (create HR record for a specific person) ────────────────

export function EnrollEmployeeDrawer({
  member,
  onClose,
  onCreated,
  initialJobTitle = '',
  submitLabel = 'Enroll',
}: {
  member: Pick<StaffProfile, 'userId' | 'name' | 'email'>;
  onClose: () => void;
  onCreated?: () => void;
  initialJobTitle?: string;
  submitLabel?: string;
}) {
  const qc = useQueryClient();
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [startDate, setStartDate] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload: CreateEmployeePayload = {
        userId: member.userId,
        jobTitle,
        employmentType,
        startDate: new Date(startDate).toISOString(),
      };
      if (department) payload.department = department;
      if (dateOfBirth) payload.dateOfBirth = new Date(dateOfBirth).toISOString();
      return createEmployee(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employees') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employee', member.userId) });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employee-me') });
      onCreated?.();
      onClose();
    },
  });

  return (
    <Drawer
      icon={UsersRound}
      title="Add employee record"
      onClose={onClose}
      footer={
        <ModalActions
          form="enroll-employee-form"
          submitLabel={submitLabel}
          pending={isPending}
          pendingLabel="Creating…"
          onCancel={onClose}
        />
      }
    >
      <form
        id="enroll-employee-form"
        onSubmit={(e) => {
          e.preventDefault();
          mutate();
        }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 border border-rule rounded-sm">
          <Avatar name={member.name} email={member.email} />
          <div>
            <p className="text-sm font-semibold text-foreground">{member.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{member.email ?? '—'}</p>
          </div>
        </div>

        <div>
          <FieldLabel required className="mb-1.5">
            Job title
          </FieldLabel>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
            placeholder="Store Manager"
            className={inp}
            autoFocus
          />
        </div>
        <div>
          <FieldLabel className="mb-1.5">Department</FieldLabel>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Operations" className={inp} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel required className="mb-1.5">
              Employment type
            </FieldLabel>
            <Select
              value={employmentType}
              onValueChange={(value) => setEmploymentType(value as EmploymentType)}
              options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: EMPLOYMENT_CONFIG[type].label }))}
              ariaLabel="Employment type"
              className={sel}
            />
          </div>
          <DatePicker label="Start date" value={startDate} onValueChange={setStartDate} required />
        </div>
        <DatePicker label="Date of birth" value={dateOfBirth} onValueChange={setDateOfBirth} />

        {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      </form>
    </Drawer>
  );
}
