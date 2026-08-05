'use server'

import { getCurrentProfile } from '@/features/auth/queries'
import { writeAuditLog } from '@/lib/audit'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'

export async function recordReportExportAudit(
  format: 'excel' | 'pdf',
  filterSummary: string
): Promise<ActionResponse> {
  try {
    const profile = await getCurrentProfile()
    if (!profile || !profile.is_active) {
      return errorResponse('กรุณาเข้าสู่ระบบก่อนทำรายการ')
    }

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
