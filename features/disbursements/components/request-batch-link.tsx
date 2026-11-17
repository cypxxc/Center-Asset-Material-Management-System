import Link from 'next/link'

export function RequestBatchLink({ id }: { id?: string | null }) {
  if (!id) return null
  return <Link href={`/disbursements/batches/${id}`} className="text-xs text-primary underline">ดูเอกสารทั้งหมดในชุดคำขอ</Link>
}
