import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-4 px-4 pb-6 text-xs text-muted-foreground">
      <span>© 2026 DUMA</span>
      <span aria-hidden="true">·</span>
      <Link href="/privacy" className="min-h-11 content-center hover:text-foreground">
        Privacy Policy
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/terms" className="min-h-11 content-center hover:text-foreground">
        Terms of Service
      </Link>
    </footer>
  );
}
