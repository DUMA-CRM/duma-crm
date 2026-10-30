import { Mascot } from '@/components/ai/Mascot';
import { Zap } from '@/components/icons';
import { SignUpButton } from '@/components/marketing/sections';

import { cn } from '@/lib/utils/cn';

/**
 * The small sign-up card in a page's side rail (blog posts, API docs), after
 * seline.com's: a softly tinted panel with a bold line, one sentence and a
 * full-width button — the mascot peeking from behind its top edge — and, under the
 * card, a quiet note with a bolt.
 */
export function SideSignUpCard({ body, className }: { body: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* Behind the card: only its top half peeks over the edge. */}
      <div className="pointer-events-none absolute -top-10 right-4" aria-hidden="true">
        <Mascot size={54} state="idle" expression="attentif" />
      </div>
      <div className="relative rounded-[12px] bg-[color-mix(in_oklab,var(--brand)_9%,var(--mkt-card))] p-1.5 ring-1 ring-[color-mix(in_oklab,var(--brand)_14%,transparent)]">
        <div className="px-3 pt-3.5 pb-3">
          <p className="pr-12 text-[0.9375rem] leading-snug font-semibold text-[var(--mkt-heading)]">The one place to run your whole business.</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--mkt-ink-2)]">{body}</p>
        </div>
        <SignUpButton className="w-full" />
      </div>
      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[13px] text-[var(--mkt-ink-3)]">
        <Zap className="size-3.5" aria-hidden="true" />
        Free plan, no card needed
      </p>
    </div>
  );
}
