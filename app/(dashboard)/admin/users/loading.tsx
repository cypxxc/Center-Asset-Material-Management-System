import { PageContainer } from '@/components/ui/page-container'

export default function UsersLoading() {
  return (
    <PageContainer>
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
        <div className="space-y-1.5">
          <div className="h-7 w-64 rounded-md bg-muted/60" />
          <div className="h-4 w-96 max-w-full rounded-md bg-muted/40" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-muted/60 self-start sm:self-auto" />
      </div>

      {/* KPI Cards Skeleton (5 cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 my-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-3 shadow-2xs space-y-1.5"
          >
            <div className="h-3 w-20 rounded bg-muted/40" />
            <div className="h-7 w-12 rounded bg-muted/60" />
          </div>
        ))}
      </div>

      {/* Filter and Search Bar Skeleton */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between mb-4 animate-pulse">
        <div className="h-9 flex-1 rounded-lg bg-muted/30" />
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <div className="h-9 w-36 rounded-lg bg-muted/30" />
          <div className="h-9 w-32 rounded-lg bg-muted/30" />
          <div className="h-9 w-16 rounded-lg bg-muted/60" />
        </div>
      </div>

      {/* Users Table Skeleton */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs animate-pulse">
        {/* Table Header */}
        <div className="border-b border-border bg-muted/40 px-4 py-3 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-3 h-4 rounded bg-muted/60" />
          <div className="col-span-3 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60 text-center" />
          <div className="col-span-1 h-4 rounded bg-muted/60" />
          <div className="col-span-1 h-4 rounded bg-muted/60 text-right" />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-border/60">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 grid grid-cols-12 gap-4 items-center">
              {/* User / Avatar */}
              <div className="col-span-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100/60 dark:bg-blue-900/50 shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <div className="h-4 w-28 rounded bg-muted/60" />
                  <div className="h-3 w-16 rounded bg-muted/40 font-mono" />
                </div>
              </div>

              {/* Email */}
              <div className="col-span-3">
                <div className="h-4 w-36 rounded bg-muted/50 font-mono" />
              </div>

              {/* Role */}
              <div className="col-span-2">
                <div className="h-6 w-28 rounded-md bg-muted/40" />
              </div>

              {/* Status */}
              <div className="col-span-2 flex justify-center">
                <div className="h-6 w-20 rounded-md bg-muted/40" />
              </div>

              {/* Date */}
              <div className="col-span-1">
                <div className="h-4 w-20 rounded bg-muted/40" />
              </div>

              {/* Actions */}
              <div className="col-span-1 flex justify-end gap-1.5">
                <div className="h-7 w-7 rounded bg-muted/40" />
                <div className="h-7 w-7 rounded bg-muted/40" />
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
