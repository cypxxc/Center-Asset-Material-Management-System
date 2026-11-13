import { PageContainer } from '@/components/ui/page-container'

export default function ProfileLoading() {
  return (
    <PageContainer>
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted/60" />
      <div className="mx-auto w-full max-w-2xl animate-pulse rounded-xl border border-border bg-card p-6 space-y-4" role="status" aria-label="กำลังโหลดแบบฟอร์มเปลี่ยนรหัสผ่าน">
        <div className="h-5 w-40 rounded bg-muted/60" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-10 rounded-lg bg-muted/40" />
          <div className="h-10 rounded-lg bg-muted/40" />
        </div>
        <div className="ml-auto h-9 w-40 rounded-lg bg-muted/60" />
      </div>
    </PageContainer>
  )
}
