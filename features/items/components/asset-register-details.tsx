import type { AssetRegisterData } from '../asset-register'
import { ASSET_REGISTER_LABELS } from '../asset-register'
import { formatDateThaiBE } from '@/lib/date'

export function AssetRegisterDetails({ item }: { item: Partial<AssetRegisterData> }) {
  const money = (value: number | null | undefined) => value == null ? 'ไม่ระบุ' : `${Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
  const entries = [
    [ASSET_REGISTER_LABELS.register_sequence, item.register_sequence || 'ไม่ระบุ'],
    [ASSET_REGISTER_LABELS.asset_prefix, item.asset_prefix || 'ไม่ระบุ'],
    [ASSET_REGISTER_LABELS.register_accumulated_depreciation, money(item.register_accumulated_depreciation)],
    [ASSET_REGISTER_LABELS.register_book_value, money(item.register_book_value)],
    [ASSET_REGISTER_LABELS.register_as_of, item.register_as_of ? formatDateThaiBE(item.register_as_of) : 'ไม่ระบุ'],
  ]
  return <section aria-label="ข้อมูลทะเบียนและยอดบัญชี" className="rounded-xl border border-border bg-card p-4">
    <h4 className="text-sm font-semibold text-card-foreground">ข้อมูลทะเบียนและยอดบัญชี</h4>
    <p className="mt-1 text-xs text-muted-foreground">ยอดที่บันทึกจากทะเบียน ณ วันที่อ้างอิง</p>
    <dl className="mt-3 space-y-3">
      {entries.map(([label, value]) => <div key={label}>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words text-sm tabular-nums text-card-foreground">{value}</dd>
      </div>)}
    </dl>
  </section>
}
