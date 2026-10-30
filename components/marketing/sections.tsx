import Link from 'next/link';

import { ArrowUpRight, ChevronDown } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';

import type { Tone } from '@/lib/marketing/home';
import { SIGN_UP_CTA, SIGN_UP_PATH, linkTo } from '@/lib/marketing/site';
import { cn } from '@/lib/utils/cn';

/**
 * The marketing site's building blocks, after seline.com's grammar: a
 * near-white canvas, a 1024px reading column, two-tone headings, white cards
 * on a hairline, a highlighter on the phrase that matters, the app's own
 * buttons and
 * handwritten notes. Materials live in app/(marketing)/marketing.css (.mkt-*).
 * Server Components, apart from the small client islands they import.
 */

// Written out in full so Tailwind sees every class.
export const TONE_FILL: Record<Tone, string> = {
  action: 'bg-primary',
  orders: 'bg-measured',
  reference: 'bg-reference',
  stock: 'bg-stock',
  team: 'bg-success',
};

export const TONE_TEXT: Record<Tone, string> = {
  action: 'text-primary',
  orders: 'text-measured',
  reference: 'text-reference',
  stock: 'text-stock',
  team: 'text-success',
};

const SPACING = {
  snug: 'py-16 sm:py-20',
  normal: 'py-20 sm:py-28',
  roomy: 'py-24 sm:py-36',
} as const;

/** The reading column every section sits in. */
export const COLUMN = 'mx-auto w-full max-w-5xl';

export function Section({
  id,
  spacing = 'normal',
  className,
  children,
  ...rest
}: { id?: string; spacing?: keyof typeof SPACING; className?: string; children: React.ReactNode } & React.AriaAttributes) {
  return (
    <section id={id} className={cn('relative scroll-mt-20 px-4 sm:px-6', SPACING[spacing], className)} {...rest}>
      <div className={cn(COLUMN, 'relative z-10')}>{children}</div>
    </section>
  );
}

/** The phrase that matters, run over with a highlighter. */
export function Mark({ children }: { children: React.ReactNode }) {
  return <span className="mkt-mark">{children}</span>;
}

/** A short line above a heading that says which part of the story this is. */
export function Eyebrow({ tone, children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2 text-sm font-medium text-[var(--mkt-ink-2)]', className)}>
      {tone && <span className={cn('size-2 rounded-[2px]', TONE_FILL[tone])} aria-hidden="true" />}
      {children}
    </p>
  );
}

/**
 * A heading in two tones: the claim in ink, then its quieter continuation —
 * "Why DUMA? Let's walk through a day." `muted` is optional.
 */
export function SectionHeading({
  eyebrow,
  tone,
  title,
  muted,
  intro,
  id,
  align = 'left',
  className,
}: {
  eyebrow?: string;
  tone?: Tone;
  title: string;
  muted?: string;
  intro?: React.ReactNode;
  id?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={cn(align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl', className)} data-reveal="">
      {eyebrow && <Eyebrow tone={tone} className={cn(align === 'center' && 'justify-center')}>{eyebrow}</Eyebrow>}
      <h2 id={id} className={cn('scroll-mt-28 text-balance text-3xl leading-[1.12] font-semibold tracking-display sm:text-4xl', eyebrow && 'mt-3')}>
        {title}
        {muted && <span className="text-[var(--mkt-ink-3)]"> {muted}</span>}
      </h2>
      {intro && <div className={cn('mt-5 text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)]', align === 'center' && 'mx-auto max-w-2xl')}>{intro}</div>}
    </div>
  );
}

/**
 * The site's buttons are the app's own (components/ui/button) at the sign-in
 * page's size, so the website and the product it leads into press the same.
 */
const MARKETING_BUTTON = 'touch' as const;

/** The site's one action — the sign-in page's primary button. */
export function SignUpButton({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link
      href={SIGN_UP_PATH}
      className={cn(buttonVariants({ size: MARKETING_BUTTON }), inverted && 'bg-white text-[var(--brand-shell)] hover:bg-white/90', className)}
    >
      {SIGN_UP_CTA}
    </Link>
  );
}

export function SecondaryButton({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: 'outline', size: MARKETING_BUTTON }), className)}>
      {children}
    </Link>
  );
}

/** A quiet text link with a diagonal arrow, for "see more" inside a card. */
export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-primary hover:underline">
      {children}
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

/** A note in the margin, in the handwritten voice, with a curling arrow. */
export function Annotation({ children, className, arrow = 'up' }: { children: React.ReactNode; className?: string; arrow?: 'up' | 'left' }) {
  return (
    <p className={cn('mkt-hand flex items-end gap-2 text-xl text-[var(--mkt-ink-2)]', className)}>
      <svg width="34" height="30" viewBox="0 0 34 30" fill="none" aria-hidden="true" className={cn('shrink-0', arrow === 'left' && '-scale-x-100')}>
        <path d="M6 4c-3 10 2 20 22 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M2 9l4-6 4 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/**
 * One feature, as a white card: icon, corner tag, title, a line of copy, an
 * optional link — and, below, a piece of the product that bleeds off the
 * card's bottom edge.
 */
export function FeatureCard({
  icon: Icon,
  tone = 'action',
  tag,
  title,
  body,
  link,
  children,
  className,
  tilt = 0,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  tone?: Tone;
  tag?: string;
  title: React.ReactNode;
  body: React.ReactNode;
  link?: { href: string; label: string };
  children?: React.ReactNode;
  className?: string;
  /** Degrees. A card or two set slightly askew keeps the grid hand-made. */
  tilt?: number;
  delay?: number;
}) {
  return (
    <article
      className={cn('mkt-card relative flex flex-col overflow-hidden', className)}
      style={tilt ? { rotate: `${tilt}deg` } : undefined}
      data-reveal=""
      data-reveal-delay={delay}
    >
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <Icon className={cn('size-6', TONE_TEXT[tone])} aria-hidden="true" />
          {tag && <span className="mkt-tag">{tag}</span>}
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-display">{title}</h3>
        <div className="mt-2 max-w-[34rem] text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{body}</div>
        {link && <CardLink href={link.href}>{link.label}</CardLink>}
      </div>
      {children && <div className="relative mt-auto">{children}</div>}
    </article>
  );
}

/** A FAQ rendered in full in the HTML — FAQPage markup is only honoured for answers on the page. */
export function Faq({ items }: { items: readonly { question: string; answer: string }[] }) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <details key={item.question} className="group py-3">
          <summary className="flex cursor-pointer list-none items-start gap-4 py-2 text-[1.0625rem] font-semibold hover:text-primary [&::-webkit-details-marker]:hidden">
            <ChevronDown className="mt-1 size-4 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true" />
            {item.question}
          </summary>
          <p className="max-w-[80ch] pb-2 pl-8 text-pretty text-[var(--mkt-ink-2)]">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

/** The ranked pains an audience lives with, each beside DUMA's answer. */
export function PainLedger({ pains }: { pains: readonly { pain: string; answer: string }[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2">
      {pains.map((item, index) => (
        <li key={item.pain} className="mkt-card px-6 py-5" data-reveal="" data-reveal-delay={index * 70}>
          <span className="font-mono text-xs text-[var(--mkt-ink-3)] tabular-nums" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <p className="mt-2 text-lg leading-snug font-semibold">{item.pain}</p>
          <p className="mt-2 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{item.answer}</p>
        </li>
      ))}
    </ol>
  );
}

export function FaqSection({ items, title = 'Questions & answers' }: { items: readonly { question: string; answer: string }[]; title?: string }) {
  return (
    <Section spacing="normal" aria-labelledby="faq">
      <SectionHeading id="faq" title={title} />
      <div className="mt-8">
        <Faq items={items} />
      </div>
    </Section>
  );
}

/**
 * The page's last word: a white card with a two-tone headline, the actions,
 * and room on the right for an illustration (the mascot, on the home page).
 */
export function ClosingCta({ title, muted, body, aside }: { title: string; muted?: string; body: string; aside?: React.ReactNode }) {
  return (
    <section className="px-4 pt-8 pb-20 sm:px-6 sm:pb-28">
      <div className={cn(COLUMN, 'mkt-card relative grid items-center gap-8 px-6 py-10 sm:px-8 md:grid-cols-[minmax(0,1fr)_22rem]')} data-reveal="">
        <div>
          <h2 className="text-balance text-3xl leading-[1.1] font-semibold tracking-display sm:text-4xl">
            {title}
            {muted && <span className="block text-[var(--mkt-ink-3)]">{muted}</span>}
          </h2>
          <p className="mt-5 max-w-[36rem] text-pretty text-[var(--mkt-ink-2)]">{body}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <SignUpButton />
            <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
          </div>
        </div>
        {aside && <div className="hidden md:block">{aside}</div>}
      </div>
    </section>
  );
}
