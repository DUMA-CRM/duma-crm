'use client';

/* A short list of parts of a whole as labelled bars on one scale — the
   biggest part fills the track — with the count and share printed beside
   each, so the bar is only a quick read of the number next to it. One hue:
   the label says which part it is, not a colour. */

export interface ShareBar {
  key: string;
  label: string;
  count: number;
  /** 0 to 1, of the whole. */
  share: number;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

export function ShareBars({ title, rows, unit }: { title: string; rows: ShareBar[]; unit: [string, string] }) {
  const peak = Math.max(0, ...rows.map((row) => row.share));
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="sr-only">{`${row.label}: ${row.count} ${row.count === 1 ? unit[0] : unit[1]}, ${percent(row.share)}`}</span>
            <span className="truncate text-foreground" aria-hidden="true">
              {row.label}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-band" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-series-1"
                style={{ width: row.count === 0 || peak === 0 ? 0 : `${Math.max(3, (row.share / peak) * 100)}%` }}
              />
            </span>
            <span className="w-16 text-right tabular-nums" aria-hidden="true">
              <span className="text-foreground">{row.count}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">{percent(row.share)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
