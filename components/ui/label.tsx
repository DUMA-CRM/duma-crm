'use client';

import type { ReactNode } from 'react';

import { useDrawerForm } from '@/components/shared/DrawerFormContext';

import { cn } from '@/lib/utils/cn';
import { fieldLabel } from '@/lib/utils/field-label';

// Sentence case, as on the marketing site — not small uppercase captions.
export const FIELD_LABEL_CLASS = 'block text-sm font-medium text-foreground';

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
