import { PageContainer } from '@/components/ui/page-container'
import { CategoryComboChartSkeleton } from '@/features/reports/components/category-combo-chart'

export function ReportsDeferredSkeleton() {
  return (
    <div className="space-y-4 pt-4">
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
  )
}

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

      {/* Category Combo Chart Skeleton (Reserves exact min-h-[480px]) */}
      <CategoryComboChartSkeleton />

      {/* Filter Bar & Data Table Skeleton */}
      <ReportsDeferredSkeleton />
    </PageContainer>
  )
}
