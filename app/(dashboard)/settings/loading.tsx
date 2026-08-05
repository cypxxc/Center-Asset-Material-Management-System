import { PageContainer } from '@/components/ui/page-container'

export default function SettingsLoading() {
  return (
    <PageContainer>
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="h-7 w-64 animate-pulse rounded-lg bg-muted/60" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-muted/40" />
      </div>

      {/* Tab Navigation Skeleton */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-32 animate-pulse rounded-t-lg bg-muted/40"
          />
        ))}
      </div>

      {/* Form Section Cards Skeleton */}
      <div className="mt-6 flex flex-col gap-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-2xs animate-pulse">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="h-5 w-40 rounded bg-muted/60" />
            <div className="h-8 w-28 rounded-lg bg-muted/40" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/40" />
                  <div className="h-4 w-36 rounded bg-muted/60" />
                </div>
                <div className="flex gap-2">
                  <div className="h-7 w-14 rounded bg-muted/40" />
                  <div className="h-7 w-14 rounded bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
