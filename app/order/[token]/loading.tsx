export default function PublicOrderLoading() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-6xl animate-pulse px-4 py-6 sm:px-6">
        <div className="h-16 rounded-lg bg-band" />
        <div className="mt-6 h-40 rounded-lg bg-band" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-40 rounded-lg bg-band" />)}
        </div>
      </div>
    </main>
  );
}
