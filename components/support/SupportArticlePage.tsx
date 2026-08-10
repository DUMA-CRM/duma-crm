'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { FileText, Mail } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { Markdown } from '@/components/shared/Markdown';
import { Button } from '@/components/ui/button';

import { type SupportArticle } from '@/lib/content/support-articles';

export function SupportArticlePage({ article }: { article: SupportArticle }) {
  const router = useRouter();

  return (
    <EditorShell
      eyebrow="Support guide"
      title={article.title}
      icon={<FileText size={20} aria-hidden="true" />}
      onClose={() => router.push('/support?tab=guides')}
      actions={
        <Button asChild variant="outline" className="h-9 gap-1.5">
          <Link href="/my-hr?tab=requests">
            <Mail size={15} aria-hidden="true" />
            <span className="hidden md:inline">Still stuck?</span>
          </Link>
        </Button>
      }
    >
      {/* Full shell width — the shell body already centres and pads the content. */}
      <article className="max-w-[70ch]">
        <p className="text-lg leading-7 text-foreground">{article.summary}</p>
        <Markdown content={article.body} className="mt-6 space-y-4" />
      </article>
    </EditorShell>
  );
}
