import Link from 'next/link'
import { ShieldCheck, LogIn, MapPin, Package, Tag, Building2, User, Info, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ZoomableImage } from '@/components/ui/zoomable-image'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import type { ItemDetail } from '@/features/items/types'

interface PublicItemViewProps {
  item: ItemDetail
}

function PublicDetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string | number | null
}) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white/80 shadow-2xs">
      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
        <div className="mt-0.5 text-sm font-bold text-slate-900 truncate">{value || '-'}</div>
      </div>
    </div>
  )
}

export function PublicItemView({ item }: PublicItemViewProps) {
  const brandModel = [item.brand, item.model].filter(Boolean).join(' / ')

  return (
    <div className="min-h-screen w-full bg-slate-100/80 p-4 sm:p-6 md:p-10 flex flex-col items-center justify-start">
      <div className="w-full max-w-2xl space-y-5">
        {/* Official Branding Header */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 rounded-xl text-emerald-400 border border-slate-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                CAMMS — ระบบบริหารจัดการทรัพย์สิน
              </h1>
              <p className="text-xs text-slate-400">
                ข้อมูลพัสดุและครุภัณฑ์ทางการ (ตรวจสอบผ่าน QR Code)
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold self-start sm:self-auto">
            อ่านอย่างเดียว (Public)
          </span>
        </div>

        {/* Item Content Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 space-y-6">
          {/* Main Title & Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {ITEM_TYPE_LABELS[item.item_type]}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                {item.item_name}
              </h2>
            </div>
            <div className="self-start sm:self-auto">
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-sm">
                สถานะ: {ITEM_STATUS_LABELS[item.status]}
              </span>
            </div>
          </div>

          {/* Item Photo if available */}
          {item.image_url && (
            <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-50 relative shadow-inner">
              <ZoomableImage
                src={item.image_url}
                alt={item.item_name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Grid Information Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PublicDetailCard
              icon={<Tag className="h-4 w-4" />}
              label="เลขครุภัณฑ์"
              value={item.asset_no}
            />
            <PublicDetailCard
              icon={<Package className="h-4 w-4" />}
              label="Serial Number"
              value={item.serial_no}
            />
            <PublicDetailCard
              icon={<Building2 className="h-4 w-4" />}
              label="หมวดหมู่"
              value={item.category?.name}
            />
            <PublicDetailCard
              icon={<MapPin className="h-4 w-4" />}
              label="สถานที่จัดเก็บ"
              value={item.location?.name}
            />
            <PublicDetailCard
              icon={<Info className="h-4 w-4" />}
              label="ยี่ห้อ / รุ่น"
              value={brandModel}
            />
            <PublicDetailCard
              icon={<User className="h-4 w-4" />}
              label="ผู้รับผิดชอบ"
              value={item.responsible_person}
            />
            <PublicDetailCard
              icon={<Package className="h-4 w-4" />}
              label="จำนวน"
              value={`${item.quantity} ${item.unit?.name ?? ''}`}
            />
            <PublicDetailCard
              icon={<DollarSign className="h-4 w-4" />}
              label="ราคาต่อหน่วย"
              value={item.unit_price == null ? null : `${item.unit_price.toLocaleString('th-TH')} บาท`}
            />
          </div>

          {/* Note section */}
          {item.note && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-xs font-bold text-slate-700">หมายเหตุ</div>
              <p className="text-xs leading-relaxed text-slate-600">{item.note}</p>
            </div>
          )}

          {/* Staff Login Action Link */}
          <div className="pt-4 border-t border-slate-100 flex flex-col items-center justify-center space-y-2">
            <p className="text-xs text-slate-500 font-medium">
              หากต้องการแก้ไขหรือจัดการข้อมูลครุภัณฑ์ชิ้นนี้
            </p>
            <Link href={`/login?next=/items/${item.id}`} className="w-full sm:w-auto">
              <Button
                type="button"
                className="w-full sm:w-auto h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                <span>เข้าสู่ระบบเพื่อจัดการ (สำหรับเจ้าหน้าที่)</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
