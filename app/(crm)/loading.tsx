import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';

/* The route-level wait, shaped like the page most routes open on: a masthead,
   a row of tiles, a list. It matches EditorShell's layout so the real page
   fills in over it rather than replacing a different picture. */
export default function CRMLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading screen">
      <div className="flex items-center justify-between gap-4">
        <Bone className="h-7 w-56 max-w-3/4" />
        <Bone className="hidden h-9 w-28 sm:block" />
      </div>
      <FactsSkeleton count={4} label="Loading figures" />
      <ListSkeleton rows={6} label="Loading list" />
    </div>
  );
}
