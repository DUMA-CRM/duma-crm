import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function SignUpPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-headline text-foreground">DUMA is currently invite-only</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          New workspaces are being set up directly during pre-launch. If your team already uses DUMA, ask a workspace manager to invite you.
        </p>
      </div>
      <Button asChild className="w-full" size="touch">
        <Link href="/sign-in">Go to sign in</Link>
      </Button>
    </>
  );
}
