import { type Capability, type CapabilitySource, hasCapability } from './capabilities.ts';

/** Connection visibility and its status request must use the same access rules. */
export function canAccessConnector(
  capabilities: CapabilitySource,
  definition: { capability?: Capability; readCapability?: Capability; moduleId?: string },
  modules: readonly { moduleId: string; status: string }[] | undefined,
): boolean {
  return (
    (!definition.capability || hasCapability(capabilities, definition.capability)) &&
    (!definition.readCapability || hasCapability(capabilities, definition.readCapability)) &&
    (!definition.moduleId || modules?.some((module) => module.moduleId === definition.moduleId && module.status === 'enabled') === true)
  );
}
