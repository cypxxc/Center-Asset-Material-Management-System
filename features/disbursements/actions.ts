'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'
import { createPostgresDisbursementDraft, updatePostgresDisbursementDraft, cancelPostgresDisbursementDraft, confirmPostgresDisbursement, returnPostgresDisbursementItem, reversePostgresDisbursement, submitPostgresBorrowRequest, rejectPostgresDisbursement } from './postgres-actions'

function refreshDisbursementCaches() {
  revalidatePath('/items'); revalidatePath('/disbursements'); revalidatePath('/', 'layout')
  revalidateTag(CACHE_TAGS.ITEMS, 'max'); revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max'); revalidateTag(CACHE_TAGS.DISBURSEMENTS, 'max')
}

async function run<T>(message: string, action: () => Promise<T>): Promise<ActionResponse<T>> {
  try { const result = await action(); refreshDisbursementCaches(); return successResponse(message, result) }
  catch (error) { return errorResponse(error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ') }
}

export async function createDisbursementDraft(input: unknown) {
  return run('สร้างเอกสารสำเร็จ', () => createPostgresDisbursementDraft(input))
}

export async function updateDisbursementDraft(input: unknown) {
  return run('แก้ไขเอกสารสำเร็จ', () => updatePostgresDisbursementDraft(input))
}

export async function cancelDisbursementDraft(input: unknown) {
  return run('ยกเลิกเอกสารสำเร็จ', () => cancelPostgresDisbursementDraft(input))
}

export async function confirmDisbursement(id: string) {
  return run('ยืนยันจ่ายพัสดุสำเร็จ', () => confirmPostgresDisbursement(id))
}

export async function returnDisbursementItem(input: unknown) {
  return run('บันทึกรับคืนสำเร็จ', () => returnPostgresDisbursementItem(input))
}

export async function reverseDisbursement(input: unknown) {
  return run('ย้อนรายการสำเร็จ', () => reversePostgresDisbursement(input))
}

export async function submitBorrowRequest(input: { item_ids: string[]; due_date: string; purpose: string }) {
  return run('ส่งคำขอสำเร็จ รอผู้ดูแลอนุมัติ', () => submitPostgresBorrowRequest(input))
}

export async function rejectDisbursement(id: string, reason?: string) {
  return run('ปฏิเสธคำขอเรียบร้อย', () => rejectPostgresDisbursement(id, reason))
}
