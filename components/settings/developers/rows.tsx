import { DocCopyButton } from './docs-blocks';

/** A value someone pastes elsewhere — a base URL, a server address: its name over it, and a copy button. */
export function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-rule/55 bg-background py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{value}</code>
        <DocCopyButton text={value} label={label} />
      </div>
    </div>
  );
}

/** An opened row's details: short labels against their values, on the quiet band. */
export function Facts({ rows }: { rows: Array<[string, React.ReactNode] | null | undefined | false | ''> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-md bg-band/60 px-3 py-2.5 text-xs">
      {rows.filter(Boolean).map((row) => {
        const [term, value] = row as [string, React.ReactNode];
        return (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="min-w-0 wrap-break-word text-foreground">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** How long a create button shows its "done" tick before the secret takes over. */
export const DONE_BEAT_MS = 650;
