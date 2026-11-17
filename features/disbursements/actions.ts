'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'
import { getCurrentProfile } from '@/features/auth/queries'
import { canCreateDisbursement } from '@/lib/permissions'
import { recoverRequestBatch } from './request-batch-queries'
import { getDisbursementSelectableItems } from './queries'
import type { DisbursementSelectableItem } from './types'
import { assignPostgresCustody, getCustodyHistory, inspectHistoricalPool, loadCustodyData } from './custody-postgres'
import { createPostgresDisbursementDraft, updatePostgresDisbursementDraft, cancelPostgresDisbursementDraft, confirmPostgresDisbursement, returnPostgresDisbursement, returnPostgresDisbursementItem, reversePostgresDisbursement, submitPostgresBorrowRequest, rejectPostgresDisbursement } from './postgres-actions'

function refreshDisbursementCaches() {
  revalidatePath('/items'); revalidatePath('/materials'); revalidatePath('/disbursements'); revalidatePath('/', 'layout')
  revalidateTag(CACHE_TAGS.ITEMS, 'max'); revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max'); revalidateTag(CACHE_TAGS.DISBURSEMENTS, 'max')
}

async function run<T>(message: string, action: () => Promise<T>): Promise<ActionResponse<T>> {
  try { const result = await action(); refreshDisbursementCaches(); return successResponse(message, result) }
  catch (error) { return errorResponse(error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ') }
}

export async function createDisbursementDraft(input: unknown) {
  return run('สร้างเอกสารสำเร็จ', () => createPostgresDisbursementDraft(input))
}

export async function recoverCartRequest(requestKey: string) {
  try { return successResponse('ตรวจสอบคำขอล่าสุดแล้ว', await recoverRequestBatch(requestKey)) }
  catch { return errorResponse<{ id: string } | null>('ตรวจสอบคำขอล่าสุดไม่สำเร็จ กรุณาลองใหม่') }
}

export async function loadDisbursementFormItems(): Promise<ActionResponse<DisbursementSelectableItem[]>> {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || !canCreateDisbursement(profile.role)) {
    return errorResponse('คุณไม่มีสิทธิ์สร้างเอกสารเบิกจ่าย')
  }
  try {
    return successResponse('โหลดรายการสำเร็จ', await getDisbursementSelectableItems())
  } catch {
    return errorResponse('โหลดรายการวัสดุไม่สำเร็จ กรุณาลองใหม่')
  }
}

export async function loadCustodyForm() {
  try { return successResponse('โหลดข้อมูลสำเร็จ', await loadCustodyData()) }
  catch { return errorResponse<Awaited<ReturnType<typeof loadCustodyData>>>('โหลดข้อมูลผู้ถือครองไม่สำเร็จ') }
}

export async function loadCustodyHistory(input: unknown = {}) {
  try { return successResponse('โหลดประวัติสำเร็จ', await getCustodyHistory(input)) }
  catch { return errorResponse<Awaited<ReturnType<typeof getCustodyHistory>>>('โหลดประวัติไม่สำเร็จ กรุณาลองใหม่') }
}

export async function assignCustody(input: unknown) {
  return run('มอบหมายผู้ถือครองแล้ว', () => assignPostgresCustody(input))
}

export async function inspectPoolHistory() {
  try { return successResponse('ตรวจสอบย้อนหลังแล้ว', await inspectHistoricalPool()) }
  catch { return errorResponse<Awaited<ReturnType<typeof inspectHistoricalPool>>>('ตรวจสอบย้อนหลังไม่สำเร็จ กรุณาลองใหม่ด้วยบัญชี admin') }
}

export async function updateDisbursementDraft(input: unknown) {
  return run('แก้ไขเอกสารสำเร็จ', () => updatePostgresDisbursementDraft(input))
}

export async function cancelDisbursementDraft(input: unknown) {
  return run('ยกเลิกเอกสารสำเร็จ', () => cancelPostgresDisbursementDraft(input))
}

export async function confirmDisbursement(id: string, replacementDueDate?: string) {
  return run('ยืนยันจ่ายวัสดุสำเร็จ', () => confirmPostgresDisbursement(id, replacementDueDate))
}

export async function returnDisbursementItem(input: unknown) {
  return run('บันทึกรับคืนสำเร็จ', () => returnPostgresDisbursementItem(input))
}

export async function returnDisbursement(id: string) {
  return run('คืนวัสดุเรียบร้อยแล้ว', () => returnPostgresDisbursement(id))
}

export async function reverseDisbursement(input: unknown) {
  return run('ย้อนรายการสำเร็จ', () => reversePostgresDisbursement(input))
}

export async function submitBorrowRequest(input: { request_key?: string; item_ids: string[]; quantities?: Record<string, number>; item_actions?: Record<string, 'issue' | 'borrow'>; request_type?: 'issue' | 'borrow'; due_date?: string | null; purpose: string }) {
  return run('ส่งคำขอสำเร็จ รอผู้ดูแลอนุมัติ', () => submitPostgresBorrowRequest(input))
}

export async function rejectDisbursement(id: string, reason?: string) {
  return run('ปฏิเสธคำขอเรียบร้อย', () => rejectPostgresDisbursement(id, reason))
}
