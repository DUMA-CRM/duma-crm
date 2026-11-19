import Link from 'next/link';

import { Sticker } from '@/components/shared/Sticker';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
      <Sticker name="cat" size={140} priority />
      <div>
        <h1 className="text-xl font-semibold text-heading">This page isn&apos;t here</h1>
        <p className="mt-1 max-w-[60ch] text-base leading-6 text-muted-foreground">It may have moved, or the link is out of date.</p>
      </div>
      <Link
        href="/dashboard"
        className="h-9 px-4 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold rounded-sm flex items-center transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
