import { cn } from '@/lib/utils';

/* A pre-printed field label: small, tracked, semibold — the naming device of
   the whole system. Archivo has real weights, so 600 is a drawn weight rather
   than the synthesised bold the previous single-weight face was faking. */
export function Label({ children, uppercase, className }: { children: React.ReactNode; uppercase?: boolean; className?: string }) {
  return <p className={cn('text-label text-muted-foreground', uppercase && 'uppercase', className)}>{children}</p>;
}
