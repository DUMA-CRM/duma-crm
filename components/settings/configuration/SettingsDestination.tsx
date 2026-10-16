import Link from 'next/link';

import { ArrowRight, type IconComponent } from '@/components/icons';

export interface SettingsDestinationProps {
  href: string;
  title: string;
  description: string;
  icon: IconComponent;
  titleOnly?: boolean;
}

/** A settings link with an icon, title and optional description. */
export function SettingsDestination({ href, title, description, icon: Icon, titleOnly = false }: SettingsDestinationProps) {
  return (
    <Link
      href={href}
      aria-label={`Configure ${title}`}
      className="group flex min-h-18 items-center gap-3 rounded-lg border border-rule/60 bg-field px-3 py-3 transition-[border-color,background-color] duration-150 hover:border-primary/45 hover:bg-band/35 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-semibold leading-5 text-foreground">{title}</span>
        </span>
        {!titleOnly && <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>}
      </span>
      <ArrowRight
        size={15}
        aria-hidden="true"
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
      />
    </Link>
  );
}
