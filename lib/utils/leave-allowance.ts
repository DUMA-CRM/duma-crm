/**
 * Whether a leave allowance can be saved, and if not, why.
 *
 * Adding a first annual allowance in a workspace with no "Annual Leave" type
 * creates that type on the way, which the API gates on `hr.leave:config` — not
 * on `hr.leave:write`, which covers the allowance itself. A store manager used
 * to press Add and get a silent 403. And until the leave types have loaded we
 * cannot know whether the type exists: saving then would create a duplicate.
 */
export type AllowanceBlock = 'loading-types' | 'types-failed' | 'needs-config' | null;

export function allowanceSaveBlock(input: {
  /** Editing an existing entitlement never creates a type. */
  editing: boolean;
  /** The "annual-default" option is chosen — the type is created if missing. */
  wantsDefaultAnnual: boolean;
  typesStatus: 'pending' | 'error' | 'success';
  annualTypeExists: boolean;
  canConfigureLeave: boolean;
}): AllowanceBlock {
  if (input.editing || !input.wantsDefaultAnnual) return null;
  if (input.typesStatus === 'pending') return 'loading-types';
  if (input.typesStatus === 'error') return 'types-failed';
  if (!input.annualTypeExists && !input.canConfigureLeave) return 'needs-config';
  return null;
}

export const ALLOWANCE_BLOCK_MESSAGE: Record<Exclude<AllowanceBlock, null>, string> = {
  'loading-types': 'Loading the leave types…',
  'types-failed': 'The leave types couldn’t load, so this allowance can’t be added yet. Close this and try again.',
  'needs-config':
    'This workspace has no annual leave type yet. Creating one needs the hr.leave:config permission — ask an owner to add the first allowance.',
};
