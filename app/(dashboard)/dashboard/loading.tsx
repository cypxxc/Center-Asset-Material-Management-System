import { PageContainer } from '@/components/ui/page-container'

export default function DashboardLoading() {
  return (
    <PageContainer
      maxWidth="full"
      className="p-4 sm:p-5 lg:px-6 lg:py-5"
      contentClassName="space-y-4 sm:space-y-5"
    >
      {/* Header Skeleton */}
      <div className="h-8 w-44 rounded-lg bg-muted/60 animate-pulse" />

      {/* Metrics Bento Grid Skeleton */}
      <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-card p-4 sm:p-4.5 rounded-xl border border-border shadow-2xs h-24 animate-pulse"
          />
        ))}
      </div>

      {/* Main Operational & Analytics Grid Skeleton */}
      <div className="grid w-full grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
        <div className="lg:col-span-7 bg-card p-4 sm:p-5 rounded-xl border border-border shadow-2xs min-h-[360px] animate-pulse" />
        <div className="lg:col-span-5 flex flex-col gap-4 lg:gap-5">
          <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-2xs min-h-[220px] animate-pulse" />
          <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-2xs min-h-[160px] animate-pulse" />
        </div>
      </div>
    </PageContainer>
  )
}
