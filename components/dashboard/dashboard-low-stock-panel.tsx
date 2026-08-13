import { Package, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

type LowStockItem = {
  id: string
  item_name: string
  quantity: number
  location: { name: string } | { name: string }[] | null
}

export async function DashboardLowStockPanel() {
  const supabase = await createClient()
  const lowStockResult = await supabase
    .from('items')
    .select('id, item_name, quantity, location:locations(name)')
    .eq('item_type', 'material')
    .lte('quantity', 5)
    .is('deleted_at', null)
    .order('quantity', { ascending: true })
    .limit(5)

  const lowStockItems = (lowStockResult.data ?? []) as LowStockItem[]
  const formattedLowStock = (lowStockItems ?? []).map((item) => {
    const locObj = item.location
    const locationName = Array.isArray(locObj) 
      ? locObj[0]?.name 
      : locObj?.name
    return {
      id: item.id,
      item_name: item.item_name,
      quantity: item.quantity,
      locationName: locationName || 'ไม่มีระบุสถานที่',
    }
  })

  return (
    <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-card-foreground text-sm mb-1">พัสดุและวัสดุใกล้หมดคลัง (Low Stock)</h3>
        <p className="text-xs text-muted-foreground mb-4">รายการวัสดุและอุปกรณ์สิ้นเปลืองที่เหลือจำนวนต่ำกว่าเกณฑ์ควบคุม (≤ 5 ชิ้น)</p>
      </div>
      
      <div className="space-y-2.5 overflow-y-auto max-h-[220px] pr-1" tabIndex={0} aria-label="รายการวัสดุคงเหลือต่ำ">
        {formattedLowStock.map((item) => (
          <div key={item.id} className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 p-2.5 rounded-lg transition-colors flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-card-foreground truncate max-w-[150px]">{item.item_name}</p>
                <p className="text-[11px] text-muted-foreground">{item.locationName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{item.quantity} ชิ้น</p>
              <span className="bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mt-0.5">ต่ำกว่าเกณฑ์</span>
            </div>
          </div>
        ))}

        {(!lowStockItems || lowStockItems.length === 0) && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-xs text-muted-foreground">ระดับสินค้าพัสดุทั้งหมดในคลังอยู่ในเกณฑ์ปกติ</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function LowStockSkeleton() {
  return (
    <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between animate-pulse" data-testid="low-stock-skeleton">
      <div>
        <div className="h-4 w-48 bg-muted rounded mb-2" />
        <div className="h-3 w-64 bg-muted rounded mb-4" />
      </div>
      
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-2.5 rounded-lg bg-muted flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-muted-foreground/20" />
              <div className="space-y-1">
                <div className="h-3 w-24 bg-muted-foreground/20 rounded" />
                <div className="h-2 w-16 bg-muted-foreground/20 rounded" />
              </div>
            </div>
            <div className="h-4 w-10 bg-muted-foreground/20 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
