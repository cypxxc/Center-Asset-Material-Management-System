'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { successResponse, errorResponse } from '@/lib/actions-helper'
import { markPostgresDisbursementHandover } from './tracking-postgres'

export async function markDisbursementHandover(id: string) {
  try {
    const result = await markPostgresDisbursementHandover(id)
    revalidatePath(`/disbursements/${result.id}`)
    revalidatePath('/disbursements')
    revalidatePath('/', 'layout')
    revalidateTag(CACHE_TAGS.DISBURSEMENTS, 'max')
    return successResponse('บันทึกผู้รับได้รับของแล้ว', result)
  } catch (error) {
    return errorResponse<Awaited<ReturnType<typeof markPostgresDisbursementHandover>>>(error instanceof Error ? error.message : 'บันทึกการรับของไม่สำเร็จ')
  }
}
