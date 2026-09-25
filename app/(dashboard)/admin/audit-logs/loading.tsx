import { PageContainer } from '@/components/ui/page-container'

export default function AuditLogsLoading() {
  return (
    <PageContainer>
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
        <div className="space-y-1.5">
          <div className="h-7 w-48 rounded-md bg-muted/60" />
          <div className="h-4 w-96 max-w-full rounded-md bg-muted/40" />
        </div>
        <div className="h-9 w-20 rounded-lg bg-muted/40 self-start sm:self-auto" />
      </div>

      {/* Metrics Banner Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between"
          >
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 rounded bg-muted/40" />
              <div className="h-7 w-16 rounded bg-muted/60" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-muted/30 shrink-0" />
          </div>
        ))}
      </div>

      {/* Filter and Search Bar Skeleton */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4 shadow-sm space-y-3 animate-pulse">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="h-9 flex-1 rounded-lg bg-muted/30" />
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <div className="h-9 w-40 rounded-lg bg-muted/30" />
            <div className="h-9 w-36 rounded-lg bg-muted/30" />
            <div className="h-9 w-20 rounded-lg bg-muted/60" />
          </div>
        </div>
      </div>

      {/* Table Skeleton Container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm animate-pulse">
        {/* Table Header */}
        <div className="border-b border-border bg-muted/40 px-4 py-3 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-3 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-3 h-4 rounded bg-muted/60" />
          <div className="col-span-4 h-4 rounded bg-muted/60" />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-border/60">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-3 space-y-1.5">
                <div className="h-4 w-32 rounded bg-muted/60" />
                <div className="h-3 w-20 rounded bg-muted/40" />
              </div>
              <div className="col-span-2">
                <div className="h-6 w-20 rounded-md bg-muted/50" />
              </div>
              <div className="col-span-3 space-y-1.5">
                <div className="h-4 w-28 rounded bg-muted/60" />
                <div className="h-3 w-36 rounded bg-muted/40 font-mono" />
              </div>
              <div className="col-span-4 space-y-1">
                <div className="h-4 w-full rounded bg-muted/30" />
                <div className="h-3 w-3/4 rounded bg-muted/20" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border">
          <div className="h-4 w-36 rounded bg-muted/40" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 rounded-lg bg-muted/30" />
            <div className="h-8 w-20 rounded-lg bg-muted/30" />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
