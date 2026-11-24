/**
 * Who sees which sidebar entry — kept apart from the nav lists in
 * lib/constants/nav.ts, which carry icon components, so the rules can be tested
 * without a renderer.
 */
import type { TenantModuleState } from '@/lib/api/modules.service';

import { type Capability, hasAnyCapability } from '../auth/capabilities.ts';
import { MODULE_IDS, type ModuleId } from '../modules/manifest.ts';

import { catalogVocabulary } from './catalog-vocabulary.ts';

/** What it takes to reach a page: its module switched on, and any one of the capabilities. */
export interface NavAccess {
  module: ModuleId;
  // Capabilities that make this visible — holding any one is enough.
  // Omit to show it to every signed-in user (Till, Kitchen, My work).
  //
  // This replaces the old `minRole` rank threshold plus its `roles` allow-list
  // escape hatch. Both existed because a rank could not express rules like
  // "hr_manager and franchise_owner, but not store_manager" — a capability
  // states the requirement directly, and matches what the API enforces on the
  // page's own data, so the nav can no longer disagree with the API.
  capabilities?: Capability[];
  /** Optional surface switch inside a module's `configuration.surfaces`. */
  surface?: string;
}

/** The parts of a sidebar entry the access rules read. `icon` is whatever the caller renders. */
export interface NavEntry<Icon = unknown> extends NavAccess {
  label: string;
  href: string;
  icon: Icon;
  /** What a shop that sells products calls this — used when its module's `configuration.vocabulary` is `retail`. */
  retail?: { label: string; icon: Icon };
  /**
   * Other ways in, for an entry that merges several features' pages into one
   * (Compliance is privacy requests and the audit log). The entry shows when its
   * own access OR any of these holds; when only an alternative does, the link
   * opens that alternative's `href` — the tab the person can actually see.
   */
  alsoFor?: (NavAccess & { href?: string })[];
  children?: Omit<NavEntry<Icon>, 'children'>[];
}

/** A run of sidebar entries under one heading. The first group has none. */
export interface NavGroup<Item extends NavEntry = NavEntry> {
  heading?: string;
  items: Item[];
}

// Without module state every module counts as on.
const DEFAULT_MODULE_STATE: TenantModuleState[] = MODULE_IDS.map((moduleId) => ({
  moduleId,
  status: 'enabled',
  configurationVersion: 1,
  configuration: {},
}));

/**
 * Filter a nav list down to what the signed-in user can reach. A parent with
 * children stays visible if it (or any child) is accessible; if the parent's own
 * page isn't accessible its link is repointed to the first accessible child.
 */
export function filterNavByCapability<Item extends NavEntry>(
  items: readonly Item[],
  capabilities: readonly string[],
  moduleState: readonly TenantModuleState[] = DEFAULT_MODULE_STATE,
): Item[] {
  // No declared capabilities means the item is for everyone. Otherwise holding
  // any one of them is enough. super_admin needs no special case — it holds
  // every capability, so it passes every check naturally.
  const canSee = (access: NavAccess) => {
    const state = moduleState.find((candidate) => candidate.moduleId === access.module);
    if (!state || state.status !== 'enabled') return false;
    if (access.surface) {
      const surfaces = state.configuration.surfaces;
      if (surfaces && typeof surfaces === 'object' && !Array.isArray(surfaces)) {
        if ((surfaces as Record<string, unknown>)[access.surface] === false) return false;
      }
    }
    return !access.capabilities || access.capabilities.length === 0 || hasAnyCapability(capabilities, ...access.capabilities);
  };

  // Where an entry leads for this person: its own page, else the first
  // alternative they can reach, else nowhere.
  const reach = (entry: Omit<NavEntry, 'children'>): string | null => {
    if (canSee(entry)) return entry.href;
    const alternative = entry.alsoFor?.find(canSee);
    return alternative ? (alternative.href ?? entry.href) : null;
  };

  // A shop sees its own words — Products, not Menu.
  const retail = catalogVocabulary(moduleState) !== 'menu';
  const worded = (item: Item): Item => (retail && item.retail ? { ...item, label: item.retail.label, icon: item.retail.icon } : item);

  return items.flatMap((original) => {
    const item = worded(original);
    const href = reach(item);
    if (item.children) {
      const children = item.children.flatMap((child) => {
        const childHref = reach(child);
        return childHref ? [{ ...child, href: childHref }] : [];
      });
      if (children.length === 0) return href ? [{ ...item, href, children: undefined }] : [];
      return [{ ...item, href: href ?? children[0].href, children }];
    }
    return href ? [{ ...item, href }] : [];
  });
}

/** The headed groups this person can see — a heading goes when every item under it does. */
export function filterNavGroups<Item extends NavEntry>(
  groups: readonly NavGroup<Item>[],
  capabilities: readonly string[],
  moduleState?: readonly TenantModuleState[],
): NavGroup<Item>[] {
  return groups.flatMap((group) => {
    const items = filterNavByCapability(group.items, capabilities, moduleState);
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

/**
 * Whether a nav link points at the page being shown. The query is ignored, so
 * an entry repointed at a tab (`/compliance?tab=audit-log`) is still current
 * across every tab of its page, and so is any page under its path.
 */
export function isNavPathActive(pathname: string, href: string): boolean {
  const path = href.split(/[?#]/, 1)[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}
