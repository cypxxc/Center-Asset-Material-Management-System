export function MetricsGridSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="metrics-grid-skeleton">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 dark:bg-card/50 p-4 sm:p-4.5 shadow-2xs flex flex-col justify-between gap-2.5 animate-pulse"
        >
          <div>
            <div className="flex items-center justify-between gap-2.5">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="w-8 h-8 shrink-0 rounded-lg bg-muted" />
            </div>
            <div className="mt-1.5">
              <div className="h-7 sm:h-8 w-32 bg-muted rounded" />
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
    <>
      <div
        className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 dark:bg-card/50 p-4 sm:p-5 shadow-2xs flex flex-col justify-between animate-pulse"
        data-testid="category-list-skeleton"
      >
        <div className="pb-3 border-b border-border/40 flex items-center justify-between">
          <div className="h-4 w-44 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
        <div className="relative py-3 flex items-center justify-center">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-[12px] border-muted" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-muted/60 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 dark:bg-card/50 p-4 sm:p-5 shadow-2xs flex flex-col justify-between animate-pulse">
        <div className="pb-3 border-b border-border/40 flex items-center justify-between">
          <div className="h-4 w-44 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
        <div className="flex-1 flex flex-col justify-center min-h-[160px] pt-3">
          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5 p-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-muted shrink-0" />
                    <div className="h-3 w-28 bg-muted rounded" />
                  </div>
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export function ActionQueueSkeleton() {
  return (
    <div
      id="action-queue"
      data-testid="action-queue-skeleton"
      className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 dark:bg-card/50 shadow-2xs flex flex-col h-full animate-pulse scroll-mt-6"
    >
      {/* Header */}
      <div className="p-4 sm:p-4.5 border-b border-border/50 bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="h-4.5 w-48 bg-muted rounded mb-1" />
          <div className="h-3 w-64 bg-muted rounded" />
        </div>
        <div className="h-6 w-28 bg-muted rounded-full" />
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-4.5 pt-3 pb-2.5 border-b border-border/40 bg-muted/5 flex items-center">
        <div className="inline-flex items-center p-1 rounded-lg bg-muted/50 border border-border/40 gap-1">
          <div className="h-7 w-32 bg-muted rounded-md" />
          <div className="h-7 w-28 bg-muted rounded-md" />
        </div>
      </div>

      {/* 3 Skeleton rows matching live component dimensions for Zero CLS */}
      <div className="divide-y divide-border/40 flex-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            data-testid="skeleton-row"
            className="p-3 sm:px-4 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
              <div className="space-y-1">
                <div className="h-3.5 w-40 bg-muted rounded" />
                <div className="h-2.5 w-28 bg-muted rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-16 bg-muted rounded-full" />
              <div className="h-7 w-16 bg-muted rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
