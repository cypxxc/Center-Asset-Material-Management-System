import { PageContainer } from '@/components/ui/page-container'

export default function ItemsLoading() {
  return (
    <PageContainer maxWidth="full">
      {/* Search and Filters Header Skeleton */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-2xs space-y-4 animate-pulse">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="h-6 w-48 rounded bg-muted/60" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 rounded-lg bg-muted/60" />
            <div className="h-9 w-28 rounded-lg bg-muted/40" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="h-9 w-full sm:w-80 rounded-lg bg-muted/40" />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="h-9 w-32 rounded-lg bg-muted/40" />
            <div className="h-9 w-32 rounded-lg bg-muted/40" />
            <div className="h-9 w-32 rounded-lg bg-muted/40" />
          </div>
        </div>
      </div>

      {/* Table Skeleton Container */}
      <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
        {/* Table Header Skeleton */}
        <div className="border-b border-border bg-muted/40 px-4 py-3 grid grid-cols-12 gap-4 items-center animate-pulse">
          <div className="col-span-1 h-4 rounded bg-muted/60" />
          <div className="col-span-3 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60" />
          <div className="col-span-2 h-4 rounded bg-muted/60 text-right" />
        </div>

        {/* Table Row Skeletons */}
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="px-4 py-3.5 grid grid-cols-12 gap-4 items-center animate-pulse hover:bg-muted/20"
            >
              <div className="col-span-1 h-8 w-8 rounded-lg bg-muted/40" />
              <div className="col-span-3 space-y-1.5">
                <div className="h-4 w-3/4 rounded bg-muted/60" />
                <div className="h-3 w-1/2 rounded bg-muted/40" />
              </div>
              <div className="col-span-2 h-4 w-20 rounded bg-muted/40" />
              <div className="col-span-2 h-4 w-24 rounded bg-muted/40" />
              <div className="col-span-2 h-5 w-16 rounded-full bg-muted/50" />
              <div className="col-span-2 flex justify-end gap-2">
                <div className="h-8 w-8 rounded-lg bg-muted/40" />
                <div className="h-8 w-8 rounded-lg bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
