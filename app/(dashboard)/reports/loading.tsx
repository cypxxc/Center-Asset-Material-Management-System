import { PageContainer } from '@/components/ui/page-container'

export default function ReportsLoading() {
  return (
    <PageContainer>
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-72 animate-pulse rounded-lg bg-muted/60" />
          <div className="h-4 w-96 animate-pulse rounded-md bg-muted/40" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-muted/60" />
        </div>
      </div>

      {/* Analytical Stat Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-2xs animate-pulse"
          >
            <div className="h-3 w-32 rounded bg-muted/40" />
            <div className="mt-3 h-8 w-44 rounded bg-muted/60" />
            <div className="mt-2 h-3 w-36 rounded bg-muted/40" />
          </div>
        ))}
      </div>

      {/* Filter Bar & Data Table Skeleton */}
      <div className="mt-6 space-y-4">
        {/* Filters Placeholder */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-full animate-pulse rounded-lg bg-muted/40 sm:w-72" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-9 w-32 animate-pulse rounded-lg bg-muted/40" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-muted/40" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-muted/40" />
          </div>
        </div>

        {/* Data Table Skeleton */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs animate-pulse">
          <div className="border-b border-border bg-muted/40 p-4">
            <div className="grid grid-cols-6 gap-4">
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="h-4 w-20 rounded bg-muted/60" />
              <div className="h-4 w-20 rounded bg-muted/60" />
              <div className="h-4 w-16 rounded bg-muted/60" />
              <div className="h-4 w-20 rounded bg-muted/60" />
              <div className="h-4 w-16 rounded bg-muted/60" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="grid grid-cols-6 gap-4 items-center">
                  <div className="h-4 w-32 rounded bg-muted/40" />
                  <div className="h-4 w-16 rounded bg-muted/40" />
                  <div className="h-4 w-24 rounded bg-muted/40" />
                  <div className="h-4 w-12 rounded bg-muted/40" />
                  <div className="h-4 w-16 rounded bg-muted/40" />
                  <div className="h-6 w-14 rounded-full bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
