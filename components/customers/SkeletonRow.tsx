export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card animate-pulse">
      <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <div className="h-4 w-12 bg-muted rounded-full" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}
