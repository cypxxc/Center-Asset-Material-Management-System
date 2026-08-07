import { PageContainer } from '@/components/ui/page-container'

export default function DashboardLoading() {
  return (
    <PageContainer maxWidth="full">
      {/* Welcome Header Skeleton */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-2xs space-y-3 animate-pulse">
        <div className="h-4 w-32 rounded-full bg-muted/60" />
        <div className="h-7 w-3/4 rounded-lg bg-muted/60" />
        <div className="h-4 w-1/2 rounded-md bg-muted/40" />
        <div className="flex gap-3 pt-1">
          <div className="h-8 w-36 rounded-lg bg-muted/60" />
          <div className="h-8 w-36 rounded-lg bg-muted/40" />
        </div>
      </div>

      {/* Metrics Bento Grid Skeleton */}
      <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card p-5 rounded-xl border border-border shadow-2xs flex items-center justify-between animate-pulse"
          >
            <div className="space-y-2 flex-1">
              <div className="h-3 w-24 rounded bg-muted/40" />
              <div className="h-7 w-20 rounded bg-muted/60" />
              <div className="h-3 w-32 rounded bg-muted/40" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-muted/40 shrink-0" />
          </div>
        ))}
      </div>

      {/* Main Charts and Status Section Skeleton */}
      <div className="grid w-full grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between min-h-[300px] animate-pulse space-y-4"
          >
            <div className="space-y-2">
              <div className="h-4 w-48 rounded bg-muted/60" />
              <div className="h-3 w-64 rounded bg-muted/40" />
            </div>
            <div className="flex-1 rounded-lg bg-muted/30 flex items-center justify-center min-h-[180px]">
              <div className="h-28 w-28 rounded-full border-4 border-muted/50" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
