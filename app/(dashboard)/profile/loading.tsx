import { PageContainer } from '@/components/ui/page-container'

export default function ProfileLoading() {
  return (
    <PageContainer>
      {/* Page Header Skeleton */}
      <div className="space-y-1.5 animate-pulse">
        <div className="h-7 w-48 rounded-md bg-muted/60" />
        <div className="h-4 w-96 max-w-full rounded-md bg-muted/40" />
      </div>

      <div className="mx-auto max-w-4xl space-y-6 animate-pulse">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Summary Card Skeleton */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col items-center text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-muted/60" />
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="h-5 w-32 rounded bg-muted/60" />
              <div className="h-3.5 w-40 rounded bg-muted/40" />
            </div>

            <div className="w-full border-t border-border pt-4 space-y-3 text-left">
              <div className="flex justify-between items-center">
                <div className="h-3.5 w-20 rounded bg-muted/40" />
                <div className="h-4 w-24 rounded bg-muted/60" />
              </div>
              <div className="flex justify-between items-center">
                <div className="h-3.5 w-20 rounded bg-muted/40" />
                <div className="h-4 w-20 rounded bg-muted/60" />
              </div>
            </div>
          </div>

          {/* Edit Forms Skeleton */}
          <div className="md:col-span-2 space-y-6">
            {/* General Info Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <div className="h-5 w-5 rounded bg-blue-100 dark:bg-blue-900/50" />
                <div className="h-5 w-36 rounded bg-muted/60" />
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-muted/50" />
                  <div className="h-10 w-full rounded-lg border border-border bg-muted/20" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 rounded bg-muted/50" />
                  <div className="h-10 w-full rounded-lg border border-border bg-muted/20" />
                </div>
                <div className="h-10 w-28 rounded-lg bg-muted/60" />
              </div>
            </div>

            {/* Change Password Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <div className="h-5 w-5 rounded bg-blue-100 dark:bg-blue-900/50" />
                <div className="h-5 w-32 rounded bg-muted/60" />
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-28 rounded bg-muted/50" />
                  <div className="h-10 w-full rounded-lg border border-border bg-muted/20" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-muted/50" />
                  <div className="h-10 w-full rounded-lg border border-border bg-muted/20" />
                </div>
                <div className="h-10 w-32 rounded-lg bg-muted/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
