import { Bone } from '@/components/shared/Skeleton';

import { cn } from '@/lib/utils/cn';

/* The guest menu loading, in the menu's own shape: the dark masthead, the
   category rail, two shelves of item cards and the docket beside them. Bones
   only — the mascot is staff-facing and never appears in the guest app. */

const ITEM_W = ['w-32', 'w-40', 'w-28', 'w-36'];

function ItemCardSkeleton({ index }: { index: number }) {
  return (
    <div className="flex min-h-36 overflow-hidden rounded-lg bg-card shadow-sm" aria-hidden="true">
      <div className="min-w-0 flex-1 space-y-2 p-4">
        <Bone className={cn('h-4', ITEM_W[index % ITEM_W.length])} />
        <Bone className="h-3 w-full max-w-56" />
        <Bone className="h-3 w-3/4 max-w-44" />
        <Bone className="mt-4 h-3.5 w-14" />
      </div>
      <Bone className="h-auto w-28 shrink-0 rounded-none sm:w-32" />
    </div>
  );
}

export function PublicMenuSkeleton({ className }: { className?: string }) {
  return (
    <main className={cn('min-h-dvh bg-background pb-24 lg:pb-0', className)} role="status" aria-busy="true" aria-label="Loading the menu">
      <header className="bg-sidebar" aria-hidden="true">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Bone className="size-10 opacity-20" />
              <div className="space-y-1.5">
                <Bone className="h-4 w-32 opacity-20" />
                <Bone className="h-3 w-24 opacity-15" />
              </div>
            </div>
            <Bone className="h-6 w-24 opacity-15" />
          </div>
          <div className="mt-8 max-w-2xl space-y-3">
            <Bone className="h-8 w-full max-w-md opacity-20 sm:h-10" />
            <Bone className="h-3.5 w-56 opacity-15" />
          </div>
        </div>
      </header>
      <div className="border-b border-rule/55 bg-background/95" aria-hidden="true">
        <div className="mx-auto flex max-w-6xl gap-2 px-4 py-2 sm:px-6">
          {['w-20', 'w-24', 'w-16', 'w-28'].map((width) => (
            <Bone key={width} className={cn('h-9 rounded-lg', width)} />
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:py-10">
        <div className="min-w-0 space-y-12">
          {[0, 1].map((shelf) => (
            <section key={shelf} aria-hidden="true">
              <Bone className={cn('mb-4 h-7', shelf === 0 ? 'w-40' : 'w-32')} />
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                  <ItemCardSkeleton key={index} index={index + shelf} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside
          className="hidden h-[calc(100dvh-7rem)] overflow-hidden rounded-lg bg-card shadow-md lg:sticky lg:top-20 lg:block"
          aria-hidden="true"
        >
          <div className="flex items-center justify-between border-b border-rule/55 px-4 py-3">
            <Bone className="h-4 w-24" />
            <Bone className="h-4 w-14" />
          </div>
        </aside>
      </div>
    </main>
  );
}

/** A tracked order loading: the status card's heading, order line and total. */
export function TrackedOrderSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg bg-card shadow-lg" role="status" aria-busy="true" aria-label="Loading your order">
      <div className="space-y-3 bg-band/40 p-6 sm:p-8" aria-hidden="true">
        <Bone className="h-8 w-72 max-w-full" />
        <Bone className="h-3.5 w-44" />
      </div>
      <div className="p-6 sm:p-8" aria-hidden="true">
        <Bone className="h-3.5 w-full max-w-md" />
        <div className="mt-7 divide-y divide-rule/45 border-y border-rule/55">
          {['w-40', 'w-32', 'w-36'].map((width) => (
            <div key={width} className="flex items-center justify-between gap-4 py-3">
              <Bone className={cn('h-3.5', width)} />
              <Bone className="h-3.5 w-14" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Bone className="h-3.5 w-10" />
          <Bone className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}
