import { PageContainer } from '@/components/ui/page-container'

export default function LocationsLoading() {
  return (
    <PageContainer maxWidth="full">
      {/* Page Header Skeleton */}
      <div className="space-y-1.5 animate-pulse">
        <div className="h-7 w-40 rounded-md bg-muted/60" />
        <div className="h-4 w-80 rounded-md bg-muted/40" />
      </div>

      {/* Main Grid: Left Locations List + Right Selected Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Locations List Skeleton */}
        <div className="lg:col-span-1 space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-blue-100/60 dark:bg-blue-950/40 shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <div className="h-4 w-28 rounded bg-muted/60" />
                  <div className="h-3 w-32 rounded bg-muted/40" />
                </div>
              </div>
              <div className="w-4 h-4 rounded bg-muted/30 shrink-0" />
            </div>
          ))}
        </div>

        {/* Right Column: Selected Location Items Skeleton */}
        <div className="lg:col-span-2 animate-pulse">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
            {/* Selected Header */}
            <div className="p-5 bg-muted/50 flex flex-wrap gap-3 items-center justify-between border-b border-border">
              <div className="space-y-1.5">
                <div className="h-5 w-56 rounded bg-muted/60" />
                <div className="h-3.5 w-72 rounded bg-muted/40" />
              </div>
              <div className="h-6 w-20 rounded-full bg-muted/50" />
            </div>

            {/* Search Input Skeleton */}
            <div className="p-4 border-b border-border bg-muted/20">
              <div className="h-9 w-full rounded-lg bg-muted/30" />
            </div>

            {/* Item Rows Skeleton */}
            <div className="p-4 space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3 bg-card border border-border rounded-xl flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded bg-muted/30 shrink-0" />
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="h-4 w-40 rounded bg-muted/60" />
                      <div className="h-3 w-52 rounded bg-muted/40" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="h-4 w-12 rounded bg-muted/50" />
                    <div className="h-5 w-16 rounded-full bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
