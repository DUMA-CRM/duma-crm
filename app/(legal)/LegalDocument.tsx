/** Shared typography for the privacy policy and terms — there is no prose plugin. */
export function LegalDocument({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="text-sm leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1 [&_p]:mt-3 [&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-3xl font-semibold tracking-display text-foreground">{title}</h1>
      <p className="!mt-2 text-xs">Last updated {updated}</p>
      {children}
    </article>
  );
}
