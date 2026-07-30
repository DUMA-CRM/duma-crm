export default function CRMLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading screen">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-8 w-64 max-w-3/4 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-border bg-muted/50" />
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}
