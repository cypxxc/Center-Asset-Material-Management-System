import { PageContainer } from '@/components/ui/page-container'

export default function DisbursementsLoading() {
  return (
    <PageContainer maxWidth="7xl">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
        <div className="space-y-1.5">
          <div className="h-7 w-64 rounded-md bg-muted/60" />
          <div className="h-4 w-96 max-w-full rounded-md bg-muted/40" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-muted/40 self-start sm:self-auto" />
      </div>

      {/* Metrics Banner Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-xl p-3.5 shadow-xs flex items-center justify-between"
          >
            <div className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-muted/40" />
              <div className="h-6 w-12 rounded bg-muted/60" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-muted/30 shrink-0" />
          </div>
        ))}
      </div>

      {/* Filter and Search Bar Skeleton */}
      <div className="bg-card border border-border rounded-xl p-3 shadow-xs space-y-3 animate-pulse">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="h-9 flex-1 w-full rounded-lg bg-muted/30" />
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="h-9 w-36 rounded-lg bg-muted/30" />
            <div className="h-9 w-40 rounded-lg bg-muted/30" />
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs animate-pulse">
        <div className="border-b border-border bg-muted/40 px-4 py-3 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-2 h-3.5 w-24 rounded bg-muted/50" />
              <div className="col-span-2 h-5 w-20 rounded bg-muted/40" />
              <div className="col-span-2 h-3.5 w-28 rounded bg-muted/50" />
              <div className="col-span-2 h-3.5 w-20 rounded bg-muted/30" />
              <div className="col-span-2 h-5 w-16 rounded bg-muted/40" />
              <div className="col-span-2 h-3.5 w-16 rounded bg-muted/30 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
