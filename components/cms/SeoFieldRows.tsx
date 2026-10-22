'use client';

import type { CmsFieldDefinition } from '@/lib/modules/cms/client';
import { SEO_RECOMMENDED_LENGTHS, seoFieldGroups } from '@/lib/utils/cms-seo';

import { FieldRows } from './FieldRows';
import { SectionInfo } from './rows';

type Data = Record<string, unknown>;

/** The SEO block as `FieldRows`, grouped as a writer decides them — each group with a heading and what it controls. */
export function SeoFieldRows({
  fields,
  value,
  onChange,
  disabled,
  locale,
  placeholders,
  open,
  onOpenChange,
}: {
  fields: CmsFieldDefinition[];
  value: Data;
  onChange: (next: Data) => void;
  disabled: boolean;
  locale: string;
  placeholders?: Readonly<Record<string, string>>;
  /** The open row's field key — owned by the editor, so another card can open one. */
  open: string | null;
  onOpenChange: (key: string | null) => void;
}) {
  return (
    <div className="divide-y divide-rule/40 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
      {seoFieldGroups(fields).map((group) => (
        <div key={group.title} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-title text-foreground">{group.title}</h3>
            <SectionInfo label={group.hint} />
          </div>
          <FieldRows
            fields={group.fields}
            value={value}
            onChange={onChange}
            disabled={disabled}
            locale={locale}
            open={open}
            onOpenChange={onOpenChange}
            placeholders={placeholders}
            recommendedLengths={SEO_RECOMMENDED_LENGTHS}
          />
        </div>
      ))}
    </div>
  );
}
