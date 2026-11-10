import { INTEGRATION_LOGOS } from '@/lib/marketing/integration-logos';
import { cn } from '@/lib/utils/cn';

/**
 * The tools DUMA works with, as one row of brand chips that scrolls for ever
 * and pauses under the pointer (`.mkt-marquee` in marketing.css). The second
 * copy of the list only exists to close the loop, so it is hidden from
 * assistive tech; with reduced motion it goes and the first wraps into rows.
 */
export function IntegrationMarquee({ className }: { className?: string }) {
  return (
    <div className={cn('mkt-marquee', className)} data-reveal="">
      <div className="mkt-marquee-track">
        {[0, 1].map((copy) => (
          <ul key={copy} className={cn('mkt-marquee-list flex shrink-0 gap-3 pr-3', copy === 1 && 'mkt-marquee-copy')} aria-hidden={copy === 1 || undefined}>
            {INTEGRATION_LOGOS.map((logo) => (
              <li
                key={logo.name}
                className="flex shrink-0 items-center gap-2.5 rounded-[10px] px-5 py-3 text-lg font-semibold whitespace-nowrap tracking-display text-white"
                style={{ background: logo.background }}
              >
                {logo.path && (
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5 shrink-0">
                    <path d={logo.path} />
                  </svg>
                )}
                {logo.name}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
