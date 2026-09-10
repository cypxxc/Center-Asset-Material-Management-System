'use server'

import { getCurrentProfile } from '@/features/auth/queries'
import { writeAuditLog } from '@/lib/audit'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'
import { checkRateLimit } from '@/lib/rate-limit'

import { ItemListSearchParams } from '@/features/items/types'
import { getExportReportItems as queryExportReportItems, ReportItemRow } from './queries'

export async function getExportReportItems(params: ItemListSearchParams): Promise<{
  items: ReportItemRow[]
  totalCount: number
  totalQuantity: number
  totalValue: number
}> {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) throw new Error('กรุณาเข้าสู่ระบบก่อนทำรายการ')

  const rateLimitCheck = await checkRateLimit('getExportReportItems', 10, 60000, profile)
  if (!rateLimitCheck.success) throw new Error(rateLimitCheck.error!)

  return await queryExportReportItems(params)
}

export async function recordReportExportAudit(
  format: 'excel' | 'pdf',
  filterSummary: string
): Promise<ActionResponse> {
  try {
    const profile = await getCurrentProfile()
    if (!profile || !profile.is_active) {
      return errorResponse('กรุณาเข้าสู่ระบบก่อนทำรายการ')
    }

    const rateLimitCheck = await checkRateLimit('recordReportExportAudit', 30, 60000, profile)
    if (!rateLimitCheck.success) return errorResponse(rateLimitCheck.error!)

    await writeAuditLog({
      operation: 'EXPORT_REPORT',
      feature: 'reports',
      userId: profile.id,
      targetType: 'reports',
      targetId: `export-${format}-${Date.now()}`,
      newValues: {
        format,
        filterSummary,
        exportedBy: profile.full_name,
        userRole: profile.role,
      },
    })

    return successResponse('บันทึกประวัติการส่งออกสำเร็จ')
  } catch {
    return errorResponse('ไม่สามารถบันทึกประวัติการส่งออกได้')
  }
}
