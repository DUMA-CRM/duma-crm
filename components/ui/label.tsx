import { cn } from '@/lib/utils';

export function Label({ children, uppercase, className }: { children: React.ReactNode; uppercase?: boolean; className?: string }) {
  return <p className={cn('text-xs font-bold text-muted-foreground tracking-widest', uppercase && 'uppercase', className)}>{children}</p>;
}
