'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CalendarDays, Clock3, FileText, Mail } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { Markdown } from '@/components/shared/Markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type SupportArticle } from '@/lib/content/support-articles';
import { formatDate } from '@/lib/utils/date';

const fmtDate = (iso: string) => formatDate(iso);

export function SupportArticlePage({ article }: { article: SupportArticle }) {
  const router = useRouter();

  return (
    <EditorShell
      eyebrow="Support guide"
      title={article.title}
      icon={<FileText size={20} aria-hidden="true" />}
      onClose={() => router.push('/support?tab=guides')}
      actions={
        <Button asChild variant="outline" className="h-10 gap-1.5">
          <Link href="/my-hr?tab=helpdesk">
            <Mail size={15} aria-hidden="true" />
            <span className="hidden md:inline">Still stuck?</span>
          </Link>
        </Button>
      }
    >
      {/* Full shell width — the shell body already centres and pads the content. */}
      <article>
        <p className="text-base leading-7 text-foreground">{article.summary}</p>
        <Markdown content={article.body} className="mt-6 space-y-4" />
      </article>
    </EditorShell>
  );
}
