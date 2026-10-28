'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { isPostgresBackend } from '@/lib/backend'
import { createClient } from '@/lib/supabase/server'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'
import {
  createPostgresDisbursementDraft,
  updatePostgresDisbursementDraft,
  cancelPostgresDisbursementDraft,
  confirmPostgresDisbursement,
  returnPostgresDisbursementItem,
  reversePostgresDisbursement,
} from './postgres-actions'
import {
  disbursementDraftSchema,
  updateDisbursementDraftSchema,
  cancelDisbursementDraftSchema,
  returnItemSchema,
  reverseDisbursementSchema,
} from './schema'

function refreshDisbursementCaches() {
  revalidatePath('/items')
  revalidatePath('/disbursements')
  revalidatePath('/', 'layout')
  revalidateTag(CACHE_TAGS.ITEMS, 'max')
  revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  revalidateTag(CACHE_TAGS.DISBURSEMENTS, 'max')
}

export async function createDisbursementDraft(rawInput: unknown): Promise<ActionResponse<{ id: string }>> {
  try {
    if (isPostgresBackend()) {
      const res = await createPostgresDisbursementDraft(rawInput)
      refreshDisbursementCaches()
      return successResponse('สร้างเอกสารฉบับร่างสำเร็จ', res)
    }

    const data = disbursementDraftSchema.parse(rawInput)
    const supabase = await createClient()

    // 1. Verify items match document type
    for (const item of data.items) {
      const { data: itemData, error } = await supabase
        .from('items')
        .select('id, item_type, asset_no')
        .eq('id', item.item_id)
        .is('deleted_at', null)
        .single()

      if (error || !itemData) return errorResponse('ไม่พบข้อมูลพัสดุหรือพัสดุถูกลบแล้ว')

      if (data.transaction_type === 'material_issue' && itemData.item_type !== 'material') {
        return errorResponse('เอกสารเบิกจ่ายพัสดุ รองรับเฉพาะรายการประเภทพัสดุเท่านั้น')
      }
      if (['asset_handover', 'asset_borrow'].includes(data.transaction_type) && itemData.item_type !== 'asset') {
        return errorResponse('เอกสารส่งมอบ/ยืมครุภัณฑ์ รองรับเฉพาะรายการประเภทครุภัณฑ์เท่านั้น')
      }
      if (data.transaction_type === 'asset_borrow') {
        if (!itemData.asset_no || !itemData.asset_no.trim()) {
          return errorResponse('การยืมครุภัณฑ์ต้องระบุครุภัณฑ์ที่มีเลขทะเบียนครุภัณฑ์ (Asset No.)')
        }
        if (item.requested_qty !== 1) {
          return errorResponse('การยืมครุภัณฑ์ที่มีทะเบียน สามารถยืมได้ครั้งละ 1 หน่วยต่อรายการ')
        }
      }
    }

    // 2. Insert document header
    const { data: { user } } = await supabase.auth.getUser()
    const { data: doc, error: docErr } = await supabase
      .from('disbursements')
      .insert({
        transaction_type: data.transaction_type,
        recipient_name: data.recipient_name,
        department_name: data.department_name,
        purpose: data.purpose,
        status: 'draft',
        due_date: data.due_date || null,
        created_by: user?.id,
      })
      .select('id')
      .single()

    if (docErr || !doc) return errorResponse(docErr?.message || 'ไม่สามารถสร้างเอกสารฉบับร่างได้')

    // 3. Insert lines
    const lineInserts = data.items.map((it) => ({
      disbursement_id: doc.id,
      item_id: it.item_id,
      requested_qty: it.requested_qty,
      status: 'pending',
    }))

    const { error: lineErr } = await supabase.from('disbursement_items').insert(lineInserts)
    if (lineErr) return errorResponse(lineErr.message)

    refreshDisbursementCaches()
    return successResponse('สร้างเอกสารฉบับร่างสำเร็จ', { id: doc.id })
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกเอกสาร')
  }
}

export async function updateDisbursementDraft(rawInput: unknown): Promise<ActionResponse<{ id: string }>> {
  try {
    if (isPostgresBackend()) {
      const res = await updatePostgresDisbursementDraft(rawInput)
      refreshDisbursementCaches()
      return successResponse('แก้ไขเอกสารฉบับร่างสำเร็จ', res)
    }

    const data = updateDisbursementDraftSchema.parse(rawInput)
    const supabase = await createClient()

    // 1. Verify draft status
    const { data: doc, error: docErr } = await supabase
      .from('disbursements')
      .select('status')
      .eq('id', data.id)
      .single()

    if (docErr || !doc) return errorResponse('ไม่พบเอกสารเบิกจ่าย')
    if (doc.status !== 'draft') return errorResponse(`สามารถแก้ไขได้เฉพาะเอกสารฉบับร่างเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)

    // 2. Verify items
    for (const item of data.items) {
      const { data: itemData, error } = await supabase
        .from('items')
        .select('id, item_type, asset_no')
        .eq('id', item.item_id)
        .is('deleted_at', null)
        .single()

      if (error || !itemData) return errorResponse('ไม่พบข้อมูลพัสดุหรือพัสดุถูกลบแล้ว')
      if (data.transaction_type === 'material_issue' && itemData.item_type !== 'material') {
        return errorResponse('เอกสารเบิกจ่ายพัสดุ รองรับเฉพาะรายการประเภทพัสดุเท่านั้น')
      }
      if (['asset_handover', 'asset_borrow'].includes(data.transaction_type) && itemData.item_type !== 'asset') {
        return errorResponse('เอกสารส่งมอบ/ยืมครุภัณฑ์ รองรับเฉพาะรายการประเภทครุภัณฑ์เท่านั้น')
      }
      if (data.transaction_type === 'asset_borrow') {
        if (!itemData.asset_no || !itemData.asset_no.trim()) {
          return errorResponse('การยืมครุภัณฑ์ต้องระบุครุภัณฑ์ที่มีเลขทะเบียนครุภัณฑ์ (Asset No.)')
        }
        if (item.requested_qty !== 1) {
          return errorResponse('การยืมครุภัณฑ์ที่มีทะเบียน สามารถยืมได้ครั้งละ 1 หน่วยต่อรายการ')
        }
      }
    }

    // 3. Update header
    const { error: updErr } = await supabase
      .from('disbursements')
      .update({
        transaction_type: data.transaction_type,
        recipient_name: data.recipient_name,
        department_name: data.department_name,
        purpose: data.purpose,
        due_date: data.due_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)

    if (updErr) return errorResponse(updErr.message)

    // 4. Replace lines
    await supabase.from('disbursement_items').delete().eq('disbursement_id', data.id)
    const lineInserts = data.items.map((it) => ({
      disbursement_id: data.id,
      item_id: it.item_id,
      requested_qty: it.requested_qty,
      status: 'pending',
    }))
    const { error: lineErr } = await supabase.from('disbursement_items').insert(lineInserts)
    if (lineErr) return errorResponse(lineErr.message)

    refreshDisbursementCaches()
    return successResponse('แก้ไขเอกสารฉบับร่างสำเร็จ', { id: data.id })
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแก้ไขเอกสาร')
  }
}

export async function cancelDisbursementDraft(rawInput: unknown): Promise<ActionResponse<{ ok: boolean }>> {
  try {
    if (isPostgresBackend()) {
      const res = await cancelPostgresDisbursementDraft(rawInput)
      refreshDisbursementCaches()
      return successResponse('ยกเลิกเอกสารฉบับร่างสำเร็จ', res)
    }

    const data = cancelDisbursementDraftSchema.parse(rawInput)
    const supabase = await createClient()

    const { data: doc, error: docErr } = await supabase
      .from('disbursements')
      .select('status')
      .eq('id', data.id)
      .single()

    if (docErr || !doc) return errorResponse('ไม่พบเอกสารเบิกจ่าย')
    if (doc.status !== 'draft') return errorResponse(`สามารถยกเลิกได้เฉพาะเอกสารฉบับร่างเท่านั้น (สถานะปัจจุบัน: ${doc.status})`)

    const { error: updErr } = await supabase
      .from('disbursements')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', data.id)

    if (updErr) return errorResponse(updErr.message)

    refreshDisbursementCaches()
    return successResponse('ยกเลิกเอกสารฉบับร่างสำเร็จ', { ok: true })
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยกเลิกเอกสาร')
  }
}

export async function confirmDisbursement(disbursementId: string): Promise<ActionResponse<{ document_no: string }>> {
  try {
    if (isPostgresBackend()) {
      const res = await confirmPostgresDisbursement(disbursementId)
      refreshDisbursementCaches()
      return successResponse('ยืนยันการเบิก-จ่ายพัสดุสำเร็จ', res)
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('confirm_disbursement_rpc', {
      p_disbursement_id: disbursementId,
    })

    if (error) return errorResponse(error.message)
    const result = data as { ok?: boolean; document_no?: string; error?: string }
    if (!result?.ok || !result.document_no) return errorResponse(result?.error || 'เกิดข้อผิดพลาดในการยืนยันเอกสาร')

    refreshDisbursementCaches()
    return successResponse('ยืนยันการเบิก-จ่ายพัสดุสำเร็จ', { document_no: result.document_no })
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยืนยันเอกสาร')
  }
}

export async function returnDisbursementItem(rawInput: unknown): Promise<ActionResponse<{ ok: boolean }>> {
  try {
    if (isPostgresBackend()) {
      const res = await returnPostgresDisbursementItem(rawInput)
      refreshDisbursementCaches()
      return successResponse('บันทึกรับคืนสำเร็จ', res)
    }

    const data = returnItemSchema.parse(rawInput)
    const supabase = await createClient()
    const { data: rpcData, error } = await supabase.rpc('return_disbursement_item_rpc', {
      p_line_id: data.line_id,
      p_return_qty: data.return_qty,
      p_condition: data.condition,
      p_note: data.note || '',
    })

    if (error) return errorResponse(error.message)
    const result = rpcData as { ok?: boolean; error?: string }
    if (!result?.ok) return errorResponse(result?.error || 'เกิดข้อผิดพลาดในการบันทึกรับคืน')

    refreshDisbursementCaches()
    return successResponse('บันทึกรับคืนสำเร็จ', { ok: true })
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกรับคืน')
  }
}

export async function reverseDisbursement(rawInput: unknown): Promise<ActionResponse<{ ok: boolean }>> {
  try {
    if (isPostgresBackend()) {
      const res = await reversePostgresDisbursement(rawInput)
      refreshDisbursementCaches()
      return successResponse('คืนสภาพเอกสารสำเร็จ', res)
    }

    const data = reverseDisbursementSchema.parse(rawInput)
    const supabase = await createClient()
    const { data: rpcData, error } = await supabase.rpc('reverse_disbursement_rpc', {
      p_disbursement_id: data.disbursement_id,
      p_reason: data.reason,
    })

    if (error) return errorResponse(error.message)
    const result = rpcData as { ok?: boolean; error?: string }
    if (!result?.ok) return errorResponse(result?.error || 'เกิดข้อผิดพลาดในการคืนสภาพเอกสาร')

    refreshDisbursementCaches()
    return successResponse('คืนสภาพเอกสารสำเร็จ', { ok: true })
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการคืนสภาพเอกสาร')
  }
}
