export default function ItemEditLoading() {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 md:p-8 animate-pulse">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted/60 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-7 w-48 rounded-md bg-muted/60" />
            <div className="h-4 w-32 rounded-md bg-muted/40" />
          </div>
        </div>

        {/* Form Sections Skeleton */}
        <div className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border bg-blue-50/50 px-4 py-3">
              <div className="h-4 w-4 rounded bg-blue-200" />
              <div className="h-4 w-28 rounded bg-muted/60" />
            </div>
            <div className="p-6 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3.5 w-20 rounded bg-muted/50" />
                  <div className="h-10 w-full rounded-lg border border-border bg-muted/20" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Asset Details */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border bg-violet-50/50 px-4 py-3">
              <div className="h-4 w-4 rounded bg-violet-200" />
              <div className="h-4 w-32 rounded bg-muted/60" />
            </div>
            <div className="p-6 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3.5 w-24 rounded bg-muted/50" />
                  <div className="h-10 w-full rounded-lg border border-border bg-muted/20" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Location and Status */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border bg-emerald-50/50 px-4 py-3">
              <div className="h-4 w-4 rounded bg-emerald-200" />
              <div className="h-4 w-36 rounded bg-muted/60" />
            </div>
            <div className="p-6 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3.5 w-20 rounded bg-muted/50" />
                  <div className="h-10 w-full rounded-lg border border-border bg-muted/20" />
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Image and Notes */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border bg-slate-100/50 px-4 py-3">
              <div className="h-4 w-4 rounded bg-slate-300" />
              <div className="h-4 w-32 rounded bg-muted/60" />
            </div>
            <div className="p-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="h-3.5 w-20 rounded bg-muted/50" />
                <div className="h-28 w-full rounded-lg border border-dashed border-border bg-muted/20" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-16 rounded bg-muted/50" />
                <div className="h-28 w-full rounded-lg border border-border bg-muted/20" />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <div className="h-10 w-24 rounded-lg bg-muted/40" />
            <div className="h-10 w-32 rounded-lg bg-muted/60" />
          </div>
        </div>
      </div>
    </div>
  )
}
