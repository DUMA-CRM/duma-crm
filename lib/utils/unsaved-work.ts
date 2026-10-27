/**
 * Open editors with unsaved changes, so a workspace switch can ask before it
 * throws them away. EditorShell registers itself while `dirty`; anything else
 * holding a draft can do the same. Module state: there is one per tab.
 */
const open = new Set<string>();

export function markUnsavedWork(id: string, dirty: boolean) {
  if (dirty) open.add(id);
  else open.delete(id);
}

export const hasUnsavedWork = (): boolean => open.size > 0;
