import { StatCardGrid, StatCardSkeleton } from '@/components/shared/StatCard';

export default function CRMLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading screen">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-8 w-64 max-w-3/4 rounded bg-muted" />
      </div>
      <StatCardGrid>
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </StatCardGrid>
      <div className="h-80 rounded-2xl border border-border bg-muted/40" />
    </div>
  );
}
