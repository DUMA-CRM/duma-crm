import { cn } from '@/lib/utils';

export function InitialsAvatar({
  firstName,
  lastName,
  size,
  className,
}: {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-sm bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white font-bold shrink-0 select-none',
        size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-10 h-10 text-sm',
        className,
      )}
    >
      {firstName[0]?.toUpperCase()}
      {lastName[0]?.toUpperCase()}
    </div>
  );
}
