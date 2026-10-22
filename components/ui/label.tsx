'use client';

import type { ReactNode } from 'react';

import { useDrawerForm } from '@/components/shared/DrawerFormContext';

import { cn } from '@/lib/utils';
import { fieldLabel } from '@/lib/utils/field-label';

export const FIELD_LABEL_CLASS = 'block text-label uppercase text-muted-foreground';

function LabelText({ children, required, optional }: { children: ReactNode; required?: boolean; optional?: boolean }) {
  const drawer = useDrawerForm();
  const marker =
    typeof children === 'string'
      ? fieldLabel(children, required, optional ?? drawer)
      : { text: children, required: Boolean(required), optional: !required && Boolean(optional ?? drawer) };
  return (
    <>
      {marker.text}
      {marker.optional && ' (optional)'}
      {marker.required && (
        <span className="ml-1 text-exception" aria-hidden="true">
          *
        </span>
      )}
    </>
  );
}

/** One field-label style and required/optional wording for drawer controls. */
export function FieldLabel({
  children,
  htmlFor,
  required,
  optional,
  className,
  as: Tag = 'label',
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  as?: 'label' | 'span';
}) {
  return (
    <Tag htmlFor={Tag === 'label' ? htmlFor : undefined} className={cn(FIELD_LABEL_CLASS, className)}>
      <LabelText required={required} optional={optional}>
        {children}
      </LabelText>
    </Tag>
  );
}

/** Legacy standalone labels share the same typography and drawer wording. */
export function Label({
  children,
  uppercase,
  className,
  required,
  optional,
}: {
  children: ReactNode;
  uppercase?: boolean;
  className?: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <p className={cn('text-label text-muted-foreground', uppercase && 'uppercase', className)}>
      <LabelText required={required} optional={optional}>
        {children}
      </LabelText>
    </p>
  );
}
