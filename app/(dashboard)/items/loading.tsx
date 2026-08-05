export default function ItemsLoading() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Integrated Header Placeholder */}
        <div className="shrink-0 border-b border-border bg-card px-6 py-5 md:px-8">
          {/* Title & View Mode Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="h-7 w-48 animate-pulse rounded-lg bg-muted/60" />
            <div className="flex shrink-0 items-center rounded-lg border border-border bg-muted p-0.5">
              <div className="h-9 w-9 animate-pulse rounded-md bg-muted/80" />
              <div className="h-9 w-9 animate-pulse rounded-md bg-muted/40" />
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="h-9 w-full rounded-lg border border-input bg-muted/40 animate-pulse sm:w-80" />
              <div className="h-9 w-36 rounded-lg border border-input bg-muted/40 animate-pulse" />
              <div className="h-9 w-32 rounded-lg border border-input bg-muted/40 animate-pulse" />
            </div>
            <div className="h-9 w-32 shrink-0 rounded-lg bg-muted/60 animate-pulse" />
          </div>
        </div>

        {/* 8 Card Grid Skeleton */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-2xs animate-pulse"
              >
                <div className="aspect-video w-full rounded-lg bg-muted/40" />
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-3/4 rounded bg-muted/60" />
                    <div className="h-4 w-12 rounded bg-muted/40" />
                  </div>
                  <div className="h-3 w-1/2 rounded bg-muted/40" />
                  <div className="mt-2 flex items-center justify-between pt-2 border-t border-border">
                    <div className="h-3 w-1/3 rounded bg-muted/40" />
                    <div className="h-5 w-16 rounded-full bg-muted/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
