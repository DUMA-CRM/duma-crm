import Link from 'next/link';

import { Mascot, type MascotFeeling } from '@/components/ai/Mascot';
import type { IconComponent } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { ExpressionId } from '@/lib/mascot/engine/expressions';
import { cn } from '@/lib/utils/cn';

/* Why a region is empty, which decides how it should read:
     start   nothing has been made here yet — the first-use screen, so it
             says what will appear and offers the way to make it
     search  there is data, but the search or filters hide all of it
     done    the list is empty because the work is finished — a good reading
     gone    the thing is missing or out of reach: deleted, not permitted */
export type EmptyStateKind = 'start' | 'search' | 'done' | 'gone';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: IconComponent;
}

interface EmptyStateProps {
  icon: IconComponent;
  title: string;
  description?: string;
  kind?: EmptyStateKind;
  /** The one way out. A primary button for `start`, quiet for everything else. */
  action?: EmptyStateAction;
  /** For the cramped places — a dashboard tile, a drawer section. */
  compact?: boolean;
  className?: string;
}

/* The face carries the kind, so a reader can tell "nothing yet" from "nothing
   matches" before reading a word. Expressions that hold the resting body only —
   see UI-ADR-008. */
const FACE: Record<EmptyStateKind, ExpressionId> = {
  start: 'attentif',
  search: 'curieux',
  done: 'heureux',
  gone: 'triste',
};

const TINT: Record<EmptyStateKind, string> = {
  start: 'text-primary',
  search: 'text-reference',
  done: 'text-momentum',
  gone: 'text-muted-foreground',
};

/* An empty region: Ask DUMA's mascot with the region’s own glyph at its shoulder,
   a plain statement, and at most one next step. Deliberately quiet — an empty
   order list at 6am is a normal reading, not an error. A failed read is
   `ErrorState`, never this.

   The glyph stays because it is the informative half: the mascot says *how*
   it is empty, the glyph says *what* is.

   It sits straight on the page. Never wrap it in a bordered card of its own:
   an empty box drawn around "nothing here" is noise. A panel that already
   exists for other content (a dashboard tile) may hold one. */
export function EmptyState({ icon: Icon, title, description, kind = 'start', action, compact = false, className }: EmptyStateProps) {
  const size = compact ? 68 : 112;

  return (
    <div className={cn('flex flex-col items-center justify-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
      <MascotGlyph
        icon={Icon}
        size={size}
        expression={FACE[kind]}
        feeling={kind === 'done' ? 'happy' : 'neutral'}
        tint={TINT[kind]}
        className={compact ? 'mb-2' : 'mb-3'}
      />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-[48ch] text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <EmptyStateButton action={action} primary={kind === 'start'} compact={compact} />}
    </div>
  );
}

/* The mascot with a glyph at its shoulder — the one picture both an empty
   region and a weighty dialog (`Modal`'s `illustration`) open on. The ball fills
   ~63% of the mascot's box, so the corner is free: the glyph sits there bare,
   in its tint, clear of the body. */
export function MascotGlyph({
  icon: Icon,
  size = 112,
  expression = 'neutre',
  feeling = 'neutral',
  tint = 'text-primary',
  className,
}: {
  icon: IconComponent;
  size?: number;
  expression?: ExpressionId;
  feeling?: MascotFeeling;
  tint?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Mascot size={size} expression={expression} feeling={feeling} fps={20} />
      <Icon size={Math.round(size * 0.23)} className={cn('absolute top-0 left-0', tint)} aria-hidden="true" />
    </div>
  );
}

function EmptyStateButton({ action, primary, compact }: { action: EmptyStateAction; primary: boolean; compact: boolean }) {
  const { label, onClick, href, icon: ActionIcon } = action;
  const content = (
    <>
      {ActionIcon && <ActionIcon data-icon="inline-start" />}
      {label}
    </>
  );
  const props = { variant: primary ? 'default' : 'outline', size: 'sm', className: compact ? 'mt-3' : 'mt-4' } as const;

  return href ? (
    <Button {...props} asChild>
      <Link href={href}>{content}</Link>
    </Button>
  ) : (
    <Button {...props} type="button" onClick={onClick}>
      {content}
    </Button>
  );
}
