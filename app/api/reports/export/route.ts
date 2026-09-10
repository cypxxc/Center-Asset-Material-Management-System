import { after, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { getCurrentProfile } from '@/features/auth/queries'
import { prepareReportExport } from '@/features/reports/queries'
import { createReportExcelStream } from '@/features/reports/excel-stream'
import { checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logging'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const filtersSchema = z.object({
  q: z.string().max(200).optional(),
  type: z.enum(['asset', 'material']).optional(),
  status: z.enum(['active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed']).optional(),
  category_id: z.uuid().optional(), location_id: z.uuid().optional(),
  sort_by: z.enum(['item_name', 'item_type', 'category', 'quantity', 'unit_price', 'total_price', 'status', 'created_at', 'updated_at']).optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
})

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile()
    if (!profile?.is_active) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนส่งออก' }, { status: 401 })
    const rate = await checkRateLimit('downloadReportExcel', 10, 60000, profile)
    if (!rate.success) return NextResponse.json({ error: rate.error }, { status: 429 })
    const query = new URL(request.url).searchParams
    const parsed = filtersSchema.safeParse(Object.fromEntries([...query.entries()].filter(([, value]) => value !== '')))
    if (!parsed.success) return NextResponse.json({ error: 'ตัวกรองส่งออกไม่ถูกต้อง' }, { status: 400 })
    const controller = new AbortController()
    const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(280000)])
    const { totalCount, batches } = await prepareReportExport(parsed.data, signal)
    if (totalCount > 1048570) return NextResponse.json({ error: 'ข้อมูลเกินจำนวนแถวที่ Excel รองรับ กรุณาลดตัวกรอง' }, { status: 400 })
    const { stream, done } = createReportExcelStream(batches, {
      signal, onCancel: () => controller.abort(), inventory: query.get('inventory') === '1',
      filterSummary: query.get('filter_summary')?.slice(0, 2000) || 'ตามตัวกรองที่เลือก',
    })
    after(async () => {
      try {
        await done
        await writeAuditLog({ operation: 'EXPORT_REPORT', feature: 'reports', userId: profile.id, targetType: 'reports', newValues: { format: 'excel', count: totalCount, filters: parsed.data } })
      } catch {
        logger.warn({ operation: 'downloadReportExcel', feature: 'reports', details: 'Download failed or was cancelled' })
      }
    })
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="office-items-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'ไม่สามารถส่งออกรายงานได้ กรุณาลองใหม่ภายหลัง' }, { status: 503 })
  }
}
