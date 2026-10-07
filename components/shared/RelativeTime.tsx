import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import { relativeTime } from '@/lib/utils/relative-time';

/** "3d ago", with the exact moment on hover and in the markup. Use it wherever
    a list shows *when* — the full date is detail, the distance is the reading. */
export function RelativeTime({ iso, className }: { iso: string | null | undefined; className?: string }) {
  if (!iso) return null;
  const label = relativeTime(iso);
  if (!label) return null;
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={cn('whitespace-nowrap', className)} suppressHydrationWarning>
      {label}
    </time>
  );
}
