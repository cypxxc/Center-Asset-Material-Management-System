export function MetricsGridSkeleton() {
  return (
    <div
      className="w-full rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 shadow-2xs divide-y lg:divide-y-0 lg:divide-x divide-border/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="metrics-grid-skeleton"
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 sm:p-4.5 flex flex-col justify-between gap-2.5 animate-pulse">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="w-7 h-7 shrink-0 rounded-md bg-muted" />
            </div>
            <div className="mt-1">
              <div className="h-7 w-32 bg-muted rounded" />
            </div>
          </div>
          <div className="h-3.5 w-36 bg-muted rounded mt-0.5" />
        </div>
      ))}
    </div>
  )
}

export function CategoryListSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5 h-full">
      <div
        className="overflow-hidden rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between animate-pulse"
        data-testid="category-list-skeleton"
      >
        <div className="pb-2.5 border-b border-border/40 flex items-center justify-between">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-4 w-14 bg-muted rounded" />
        </div>
        <div className="relative py-2 flex items-center justify-center">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-[10px] border-muted" />
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-border/40">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 bg-muted/60 rounded-md" />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between flex-1 animate-pulse">
        <div className="pb-2.5 border-b border-border/40 flex items-center justify-between">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-4 w-14 bg-muted rounded" />
        </div>
        <div className="flex-1 flex flex-col justify-center min-h-[140px] pt-2">
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1 p-0.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-muted shrink-0" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-3 w-20 bg-muted rounded" />
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ActionQueueSkeleton() {
  return (
    <div
      id="action-queue"
      data-testid="action-queue-skeleton"
      className="overflow-hidden rounded-xl border border-border/70 bg-card/60 dark:bg-card/40 shadow-2xs flex flex-col h-full animate-pulse scroll-mt-6"
    >
      {/* Header */}
      <div className="px-4 py-3 sm:px-4.5 sm:py-3.5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <div className="h-4 w-44 bg-muted rounded mb-1" />
          <div className="h-3 w-60 bg-muted rounded" />
        </div>
        <div className="h-5 w-24 bg-muted rounded-full" />
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-4.5 py-2 border-b border-border/40 bg-muted/20 flex items-center">
        <div className="inline-flex items-center p-0.5 rounded-lg bg-muted/50 border border-border/40 gap-1">
          <div className="h-6 w-28 bg-muted rounded-md" />
          <div className="h-6 w-24 bg-muted rounded-md" />
        </div>
      </div>

      {/* 3 Skeleton rows matching live component dimensions for Zero CLS */}
      <div className="divide-y divide-border/30 flex-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            data-testid="skeleton-row"
            className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-muted shrink-0" />
              <div className="space-y-1">
                <div className="h-3.5 w-36 bg-muted rounded" />
                <div className="h-2.5 w-24 bg-muted rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-14 bg-muted rounded-full" />
              <div className="h-6 w-14 bg-muted rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
