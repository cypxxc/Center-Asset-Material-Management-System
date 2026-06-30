import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteItemButton } from '@/features/items/components/delete-item-button'
import { getItemById, getItemAuditLogs } from '@/features/items/queries'
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
  const [item, profile, auditLogs] = await Promise.all([
    getItemById(id),
    getCurrentProfile(),
    getItemAuditLogs(id)
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

        {/* Audit Log Timeline (Admin Only) */}
        {profile?.role === 'admin' && auditLogs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
              ประวัติการทำรายการและตรวจนับ (Audit Logs)
            </h3>
            <div className="flow-root">
              <ul className="-mb-8">
                {auditLogs.map((log, logIdx) => {
                  let actionText = log.action
                  if (log.action === 'create') actionText = 'ขึ้นทะเบียนใหม่ (Created)'
                  if (log.action === 'update') actionText = 'แก้ไขข้อมูล (Updated)'
                  if (log.action === 'delete') actionText = 'ลบพัสดุ (Deleted)'

                  return (
                    <li key={log.id}>
                      <div className="relative pb-8">
                        {logIdx !== auditLogs.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center ring-8 ring-white">
                              <span className="material-symbols-outlined text-[15px] text-blue-600">history</span>
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-xs text-slate-800 font-bold">
                                {actionText}{' '}
                                <span className="font-semibold text-slate-500">โดย {log.user_name}</span>
                              </p>
                              {/* Displaying diff details */}
                              {log.old_data && log.new_data && (
                                <div className="mt-2 text-[11px] bg-slate-50 border border-slate-100 p-2 rounded-lg font-mono text-slate-600 max-h-32 overflow-y-auto space-y-1">
                                  {Object.keys(log.new_data).map((key) => {
                                    const oldVal = log.old_data ? (log.old_data as Record<string, unknown>)[key] : null
                                    const newVal = log.new_data ? (log.new_data as Record<string, unknown>)[key] : null
                                    if (oldVal !== newVal && key !== 'updated_at') {
                                      return (
                                        <div key={key}>
                                          <span className="font-bold text-slate-700">{key}</span>: {String(oldVal ?? 'none')} ➔ <span className="font-bold text-blue-600">{String(newVal ?? 'none')}</span>
                                        </div>
                                      )
                                    }
                                    return null
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-semibold">
                              {new Date(log.created_at).toLocaleString('th-TH')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
