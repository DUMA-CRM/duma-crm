'use client';

import { CalendarDays, Clock3, FileText, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { EditorShell } from '@/components/shared/EditorShell';
import { Markdown } from '@/components/shared/Markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type SupportArticle } from '@/lib/content/support-articles';

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function SupportArticlePage({ article }: { article: SupportArticle }) {
  const router = useRouter();

  return (
    <EditorShell
      eyebrow="Support guide"
      title={article.title}
      icon={<FileText size={20} aria-hidden="true" />}
      onClose={() => router.push('/support?tab=guides')}
      meta={
        <>
          <Badge variant="primary">{article.category}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 size={12} aria-hidden="true" /> {article.readMinutes} min read
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays size={12} aria-hidden="true" /> Updated {fmtDate(article.updated)}
          </span>
        </>
      }
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
