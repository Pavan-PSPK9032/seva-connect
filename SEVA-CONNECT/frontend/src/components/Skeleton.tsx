export function CardSkeleton() {
  return (
    <div className="card flex h-full animate-pulse flex-col p-5">
      <div className="flex items-center justify-between">
        <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-white/10" />
        <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-white/10" />
      </div>
      <div className="mt-4 h-4 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-4 h-3 w-full rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-2 h-3 w-5/6 rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-5 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-white/10" />
        <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-white/10" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}