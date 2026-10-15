import { PageContainer } from '@/components/ui/page-container'

export default function AdminLoading() {
  return (
    <PageContainer>
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-pulse">
        <div className="space-y-1.5">
          <div className="h-7 w-64 rounded-md bg-muted/60" />
          <div className="h-4 w-96 max-w-full rounded-md bg-muted/40" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-muted/60 self-start sm:self-auto" />
      </div>

      {/* Admin Content Area Skeleton */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-2xs space-y-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-muted/60" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="space-y-1.5 flex-1 max-w-md">
                <div className="h-4 w-3/4 rounded bg-muted/50" />
                <div className="h-3 w-1/2 rounded bg-muted/30" />
              </div>
              <div className="h-8 w-20 rounded-lg bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
