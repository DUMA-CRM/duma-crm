import { cn } from '@/lib/utils';

import { GravatarImage } from './GravatarImage';

export function InitialsAvatar({
  firstName,
  lastName,
  email,
  size,
  className,
}: {
  firstName: string;
  lastName: string;
  /** When present, a Gravatar for this email is shown, falling back to initials. */
  email?: string;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const sizeClasses = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-10 h-10 text-sm';
  // Request @2x-ish pixels for crisp rendering.
  const px = size === 'lg' ? 192 : 80;

  const fallback = (
    <div
      className={cn(
        'rounded-sm bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white font-bold shrink-0 select-none',
        sizeClasses,
        className,
      )}
    >
      {firstName[0]?.toUpperCase()}
      {lastName[0]?.toUpperCase()}
    </div>
  );

  if (!email) return fallback;

  return (
    <GravatarImage
      email={email}
      px={px}
      alt={`${firstName} ${lastName}`.trim()}
      fallback={fallback}
      className={cn('rounded-sm object-cover shrink-0 select-none', sizeClasses, className)}
    />
  );
}
