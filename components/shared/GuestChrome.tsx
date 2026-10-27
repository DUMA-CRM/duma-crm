import { Logo } from '@/components/shared/Logo';

// The chrome of every guest-facing page — the booking page, a hosted form:
// the business's name in the same dark band as the QR menu, and the page a
// guest lands on when a link no longer leads anywhere.

/** The place, in the same dark band as the QR menu. */
export function GuestHeader({ brandName, place }: { brandName: string; place?: string }) {
  return (
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-5 sm:px-6">
        <Logo size={38} variant="onDark" />
        <div>
          <p className="font-semibold">{brandName}</p>
          {place && <p className="text-xs text-sidebar-foreground/70">{place}</p>}
        </div>
      </div>
    </header>
  );
}

export function GuestUnavailable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5">
      <div className="max-w-md text-center">
        <Logo size={48} className="mx-auto" />
        <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </main>
  );
}
