export default function DisbursementsLoading() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground font-sans">
      <div className="flex min-h-0 flex-1 min-w-0 overflow-hidden">
        <main className="flex flex-1 flex-col min-w-0 overflow-hidden bg-background">
          {/* Header Skeleton */}
          <div className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-6 w-56 rounded-md bg-muted/60" />
                <div className="h-5 w-20 rounded-full bg-muted/40" />
              </div>
              <div className="h-8 w-36 rounded-lg bg-muted/40" />
            </div>
          </div>

          {/* Filter Bar Skeleton */}
          <div className="shrink-0 border-b border-border bg-card/60 px-4 py-2.5 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 animate-pulse">
              <div className="h-9 w-full sm:w-80 rounded-lg bg-muted/40" />
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="h-9 w-32 rounded-lg bg-muted/40" />
                <div className="h-9 w-32 rounded-lg bg-muted/40" />
              </div>
            </div>
          </div>

          {/* Table Area Skeleton */}
          <div className="flex-1 min-h-0 overflow-auto bg-background">
            <div className="border-b border-border bg-muted/40 px-4 py-3 grid grid-cols-12 gap-4 items-center animate-pulse">
              <div className="col-span-2 h-4 rounded bg-muted/60" />
              <div className="col-span-2 h-4 rounded bg-muted/60" />
              <div className="col-span-2 h-4 rounded bg-muted/60" />
              <div className="col-span-2 h-4 rounded bg-muted/60" />
              <div className="col-span-2 h-4 rounded bg-muted/60" />
              <div className="col-span-2 h-4 rounded bg-muted/60 text-right" />
            </div>
            <div className="divide-y divide-border/40">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 grid grid-cols-12 gap-4 items-center animate-pulse">
                  <div className="col-span-2 h-4 w-28 rounded bg-muted/50" />
                  <div className="col-span-2 h-5 w-20 rounded bg-muted/40" />
                  <div className="col-span-2 h-4 w-24 rounded bg-muted/50" />
                  <div className="col-span-2 h-4 w-28 rounded bg-muted/30" />
                  <div className="col-span-2 h-5 w-16 rounded bg-muted/40" />
                  <div className="col-span-2 h-4 w-16 rounded bg-muted/30 ml-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* Footer Skeleton */}
          <div className="flex min-h-12 py-2.5 shrink-0 items-center justify-between border-t border-border bg-card px-4 animate-pulse">
            <div className="h-5 w-40 rounded bg-muted/40" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 rounded bg-muted/40" />
              <div className="h-8 w-8 rounded bg-muted/60" />
              <div className="h-8 w-20 rounded bg-muted/40" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
