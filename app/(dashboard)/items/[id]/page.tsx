import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteItemButton } from '@/features/items/components/delete-item-button'
import { getItemById } from '@/features/items/queries'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete } from '@/lib/permissions'

interface ItemDetailPageProps {
  params: Promise<{
    id: string
  }>
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value || '-'}</div>
    </div>
  )
}

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { id } = await params
  const [item, profile] = await Promise.all([
    getItemById(id),
    getCurrentProfile()
  ])

  if (!item) notFound()

  const userCanWrite = canWrite(profile?.role)
  const userCanDelete = canDelete(profile?.role)

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/items">
              <Button variant="outline" size="icon-sm" className="rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{item.item_name}</h2>
              <p className="text-sm text-muted-foreground">รายละเอียดสิ่งของในระบบทะเบียน</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userCanWrite && (
              <Link href={`/items/${item.id}/edit`}>
                <Button variant="outline" className="font-semibold flex items-center gap-1.5 h-10 px-4">
                  <Edit className="h-4 w-4" />
                  <span>แก้ไข</span>
                </Button>
              </Link>
            )}
            {userCanDelete && <DeleteItemButton id={item.id} />}
          </div>
        </div>


        <div className={item.image_url ? "grid gap-6 md:grid-cols-[1fr_280px]" : "grid gap-6"}>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
            <section className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="ประเภท" value={ITEM_TYPE_LABELS[item.item_type]} />
              <DetailRow label="สถานะ" value={ITEM_STATUS_LABELS[item.status]} />
              <DetailRow label="หมวดหมู่" value={item.category?.name} />
              <DetailRow label="จำนวน" value={`${item.quantity} ${item.unit?.name ?? ''}`} />
              <DetailRow label="เลขครุภัณฑ์" value={item.asset_no} />
              <DetailRow label="Serial Number" value={item.serial_no} />
              <DetailRow label="ยี่ห้อ" value={item.brand} />
              <DetailRow label="รุ่น" value={item.model} />
              <DetailRow label="สถานที่" value={item.location?.name} />
              <DetailRow label="ผู้รับผิดชอบ" value={item.responsible_person} />
            </section>

            <section className="rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-bold text-foreground">หมายเหตุ</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.note || 'ไม่มีหมายเหตุ'}</p>
            </section>
          </div>

          {item.image_url && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">รูปภาพสิ่งของ</span>
              <div className="relative rounded-lg overflow-hidden border border-border aspect-square bg-muted/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.item_name}
                  className="object-cover w-full h-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
