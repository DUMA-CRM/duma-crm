/**
 * Where a brand-new workspace goes first, and the two buttons that say so.
 *
 * `/dashboard` belongs to the analytics module, which is only on when someone
 * chose Reports — sending everyone there landed most new owners on a page
 * whose data calls were refused. The first useful page follows what the
 * owner actually switched on.
 */
import { type OnboardingDraft, hasPremises, sellsOnline } from './flow.ts';

export interface NextStep {
  label: string;
  href: string;
}

export interface Landing {
  message: string;
  primary: NextStep;
  secondary: NextStep;
}

/** The first page this workspace can actually open, by what it runs. */
export function homeFor(modules: readonly string[]): NextStep {
  if (modules.includes('analytics')) return { label: 'Go to dashboard', href: '/dashboard' };
  if (modules.includes('pos')) return { label: 'Open the till', href: '/pos' };
  if (modules.includes('ordering')) return { label: 'Open orders', href: '/orders' };
  if (modules.includes('customers')) return { label: 'Open customers', href: '/customers' };
  return { label: 'Open settings', href: '/settings' };
}

export function landingFor(modules: readonly string[], draft: Pick<OnboardingDraft, 'presence' | 'businessName'>): Landing {
  const name = draft.businessName.trim() || 'Your business';
  // An online shop's first job is its catalogue, then plugging its website in.
  if (sellsOnline(draft as OnboardingDraft) && modules.includes('catalog')) {
    return {
      message: hasPremises(draft as OnboardingDraft)
        ? `${name} is ready. Add what you sell — or import it from a sheet — then connect your online store.`
        : `${name} is ready. Add your products — or import them from a sheet — then connect your website.`,
      primary: { label: 'Add your products', href: '/menu/items' },
      secondary: { label: 'Connect your website', href: '/settings/developers' },
    };
  }
  return {
    message: `${name} is ready. Next, add what you sell and invite your team. The setup checklist walks you through it.`,
    primary: { label: 'Continue setup', href: '/settings/workspaces' },
    secondary: homeFor(modules),
  };
}
