import { X } from '@/components/icons';

/**
 * One active filter, stated in words and removable on the spot.
 *
 * The chip row is what lets a filter toolbar collapse: the controls can hide
 * behind a popover because the *state* they produced never does. A filter the
 * user cannot see is a filter they will blame the data for.
 */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 pl-2.5 pr-1.5 text-xs font-medium text-primary">
      <span className="max-w-52 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="flex size-5 items-center justify-center rounded-full hover:bg-band focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <X size={11} aria-hidden="true" />
      </button>
    </span>
  );
}
