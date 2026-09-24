import type { ModuleId } from './manifest';

/**
 * Every server-state key begins with its product-module owner. Prefix
 * invalidation can therefore stay broad inside one module without evicting an
 * unrelated workspace, and a resource cannot silently drift between features.
 */
function createModuleQueryKeys<const TModule extends ModuleId>(moduleId: TModule) {
  return {
    all: [moduleId] as const,
    key: <const TResource extends string, const TParts extends readonly unknown[]>(resource: TResource, ...parts: TParts) =>
      [moduleId, resource, ...parts] as const,
  };
}

export const moduleQueryKeys = {
  core: createModuleQueryKeys('core'),
  identity: createModuleQueryKeys('identity'),
  organization: createModuleQueryKeys('organization'),
  customers: createModuleQueryKeys('customers'),
  catalog: createModuleQueryKeys('catalog'),
  ordering: createModuleQueryKeys('ordering'),
  payments: createModuleQueryKeys('payments'),
  inventory: createModuleQueryKeys('inventory'),
  purchasing: createModuleQueryKeys('purchasing'),
  workforce: createModuleQueryKeys('workforce'),
  people: createModuleQueryKeys('people'),
  communications: createModuleQueryKeys('communications'),
  compliance: createModuleQueryKeys('compliance'),
  analytics: createModuleQueryKeys('analytics'),
  agent: createModuleQueryKeys('agent'),
  support: createModuleQueryKeys('support'),
} as const;
