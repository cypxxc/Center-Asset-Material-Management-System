export default function ItemDetailLoading() {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 md:p-8 animate-pulse">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-muted/60 shrink-0" />
            <div className="space-y-1.5">
              <div className="h-7 w-52 rounded-md bg-muted/60" />
              <div className="h-4 w-36 rounded-md bg-muted/40" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-9 w-24 rounded-lg bg-muted/40" />
            <div className="h-9 w-20 rounded-lg bg-muted/40" />
            <div className="h-9 w-20 rounded-lg bg-muted/40" />
          </div>
        </div>

        {/* Main Details and Image Grid */}
        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          {/* Details Card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                  <div className="h-3 w-16 rounded bg-muted/40" />
                  <div className="h-4 w-28 rounded bg-muted/60" />
                </div>
              ))}
            </div>

            {/* Depreciation Box Skeleton */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="h-4 w-32 rounded bg-muted/60" />
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                    <div className="h-3 w-20 rounded bg-muted/40" />
                    <div className="h-4 w-24 rounded bg-muted/60" />
                  </div>
                ))}
              </div>
            </div>

            {/* Note Box Skeleton */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <div className="h-4 w-20 rounded bg-muted/60" />
              <div className="h-4 w-3/4 rounded bg-muted/40" />
            </div>
          </div>

          {/* Image Placeholder Card */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3 h-fit">
            <div className="h-3 w-24 rounded bg-muted/40" />
            <div className="rounded-lg aspect-square bg-muted/20 border border-border" />
          </div>
        </div>

        {/* Audit Timeline Skeleton */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="h-5 w-36 rounded bg-muted/60" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-muted/60 shrink-0" />
                <div className="h-4 flex-1 rounded bg-muted/30" />
                <div className="h-3 w-20 rounded bg-muted/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
