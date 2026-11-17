export default function MaterialsLoading() {
  return <div className="p-4 sm:p-6" role="status" aria-busy="true">
    <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลวัสดุ…</p>
    <div className="mt-4 h-64 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
  </div>
}
