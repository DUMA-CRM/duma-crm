import { CheckCircle2 } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)]">
      <aside className="hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="flex items-center gap-3">
          <Logo size={40} variant="onDark" className="rounded-md shadow-sm" />
          <div>
            <p className="text-lg font-semibold leading-tight">DUMA</p>
            <p className="mt-0.5 text-xs text-sidebar-foreground/65">Coffee operations, connected</p>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-display">The whole shift, in one calm workspace.</h2>
          <div className="mt-8 space-y-4 text-sm text-sidebar-foreground/78">
            {[
              'Orders move from till to kitchen',
              'Stock risks surface before the rush',
              'Every role sees the work that belongs to them',
            ].map((item) => (
              <p key={item} className="flex items-center gap-3">
                <CheckCircle2 size={18} className="shrink-0 text-sidebar-primary" aria-hidden="true" />
                {item}
              </p>
            ))}
          </div>
        </div>
        <p className="text-xs text-sidebar-foreground/55">Built for independent coffee teams and growing groups.</p>
      </aside>

      <div className="flex min-h-dvh flex-col items-center justify-center p-4 sm:p-8">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <Logo size={36} className="rounded-md shadow-sm" />
          <div>
            <p className="text-base font-semibold leading-tight text-foreground">DUMA</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Coffee operations, connected</p>
          </div>
        </div>
        <main className="w-full max-w-md rounded-lg border border-rule/65 bg-card p-6 shadow-md md:p-8">{children}</main>
      </div>
    </div>
  );
}
