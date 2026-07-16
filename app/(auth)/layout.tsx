import { Coffee } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Brand lockup */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center text-white shrink-0">
          <Coffee size={16} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-base leading-tight text-foreground tracking-tight">DUMA</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-0.5">Coffee CRM</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 md:p-8 shadow-[0_4px_10px_-2px_rgb(30_27_22/0.08)]">
        {children}
      </div>
    </div>
  );
}
