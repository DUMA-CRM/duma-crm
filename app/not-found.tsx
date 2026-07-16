import { Coffee } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Coffee size={28} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground mt-1">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      </div>
      <Link
        href="/dashboard"
        className="h-9 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg flex items-center transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
