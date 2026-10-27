'use client';
import { RichTextPreview } from '@/components/cms/RichTextPreview';
import { Button } from '@/components/ui/button';

import type { UpdateContent } from '@/lib/modules/identity/client';
import { safeHref } from '@/lib/utils/cms';

export const UPDATE_CATEGORIES = [
  { value: 'new', label: 'New' },
  { value: 'improved', label: 'Improved' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'important', label: 'Important' },
  { value: 'retired', label: 'Retired' },
];
export function UpdateArticle({ content, publishedAt }: { content: UpdateContent; publishedAt?: string | null }) {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>{UPDATE_CATEGORIES.find((item) => item.value === content.category)?.label}</span>
        {publishedAt && (
          <time dateTime={publishedAt}>
            {new Date(publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
        )}
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.title}</h1>
        <p className="max-w-prose text-base leading-relaxed text-muted-foreground">{content.summary}</p>
      </div>
      <RichTextPreview markdown={content.body} resolveWorkspaceImages={false} />
      {content.actionLabel && safeHref(content.actionUrl) && (
        <Button asChild>
          <a href={content.actionUrl}>{content.actionLabel}</a>
        </Button>
      )}
    </article>
  );
}
