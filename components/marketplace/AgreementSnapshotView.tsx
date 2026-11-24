import type { AgreementSnapshot } from '@/lib/marketplace/creator-agreement-storage';

export function AgreementSnapshotView({ document, language }: AgreementSnapshot) {
  return (
    <article lang={language === 'uk' ? 'uk' : 'en-GB'} className="space-y-6 break-words rounded-lg border border-border bg-card p-5 sm:p-8 print:border-0 print:p-0">
      <header className="space-y-2 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">{document.campaign}</p>
        <h2 className="font-serif text-3xl font-semibold text-heading">{document.title}</h2>
      </header>
      {document.sections.map(({ heading, body }, index) => (
        <section key={index}>
          <h3 className="mb-1 font-semibold text-heading print:break-after-avoid">{index + 1}. {heading}</h3>
          <p className="whitespace-pre-wrap leading-relaxed">{body}</p>
        </section>
      ))}
    </article>
  );
}
