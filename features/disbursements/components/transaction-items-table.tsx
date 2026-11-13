'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { isDateReachedInBangkok } from '@/lib/date'
import { returnDisbursementItem } from '../actions'
import type { DisbursementRow, DisbursementRequestedItem, ItemCondition } from '../types'

export function TransactionItemsTable({ document, userRole }: { document: DisbursementRow; userRole: string }) {
  const router = useRouter()
  const canReturn = userRole === 'admin' && document.transaction_type === 'asset_borrow' && ['active_borrow', 'partially_returned'].includes(document.status) && isDateReachedInBangkok(document.due_date)
  const [line, setLine] = useState<DisbursementRequestedItem | null>(null)
  const [condition, setCondition] = useState<ItemCondition>('normal')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const returnTrigger = useRef<HTMLButtonElement | null>(null)
  const received = useRef(false)

  async function receive(event: React.FormEvent) {
    event.preventDefault()
    if (!line || !canReturn || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const result = await returnDisbursementItem({ line_id: line.line_id, return_qty: line.issued_qty - line.returned_qty, condition, note: note || null })
      if (!result.ok) { setError(result.error || 'บันทึกรับคืนไม่สำเร็จ'); return }
      received.current = true
      setLine(null)
      router.refresh()
    } catch {
      setError('บันทึกรับคืนไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <>
    <table aria-label="รายการพัสดุในคำขอ" className="w-full text-left text-sm [&_th]:px-4 [&_th]:py-2 [&_th]:font-medium [&_td]:px-4 [&_td]:py-3">
      <thead className="border-b border-border text-xs text-muted-foreground"><tr>
        <th scope="col">เลขครุภัณฑ์</th><th scope="col">รายการพัสดุ</th>
        <th scope="col" className="text-right">ขอ</th><th scope="col" className="text-right">จ่าย</th>
        <th scope="col" className="text-right">คืนแล้ว</th><th scope="col" className="text-right">คงค้าง</th><th scope="col">สถานะรายการ</th>
        {canReturn && <th scope="col" className="text-right">คืน</th>}
      </tr></thead>
      <tbody className="divide-y divide-border">
        {(document.requested_items || []).map(item => {
          const outstanding = Math.max(0, item.issued_qty - item.returned_qty)
          const labels = { pending: 'รออนุมัติ', issued: 'จ่ายแล้ว', partially_returned: 'คืนบางส่วน', returned: 'คืนแล้ว', reversed: 'ย้อนรายการแล้ว' }
          return <tr key={item.line_id} className="align-middle">
            <td className="font-mono text-xs whitespace-nowrap">{item.asset_no || '—'}</td>
            <td><div className="flex items-center gap-3">
              {/* Inventory URLs may point to either backend's existing storage. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.image_url && <img src={item.image_url} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded object-contain" />}
              <span className="min-w-0 break-words">{item.item_name}</span>
            </div></td>
            <td className="text-right tabular-nums">{item.requested_qty}</td><td className="text-right tabular-nums">{item.issued_qty}</td>
            <td className="text-right tabular-nums">{item.returned_qty}</td><td className="text-right tabular-nums">{document.transaction_type === 'asset_borrow' ? outstanding : '—'}</td>
            <td className="whitespace-nowrap">{labels[item.status]}</td>
            {canReturn && <td className="text-right">{outstanding > 0 && <Button size="sm" variant="outline" disabled={busy} aria-label={`คืน ${item.asset_no || item.item_name}`} onClick={event => { returnTrigger.current = event.currentTarget; received.current = false; setLine(item); setCondition('normal'); setNote(''); setError('') }}>คืน</Button>}</td>}
          </tr>
        })}
        {!document.requested_items?.length && <tr><td colSpan={canReturn ? 8 : 7} className="text-center text-muted-foreground">ไม่มีรายการพัสดุ</td></tr>}
      </tbody>
    </table>
    <Dialog.Root open={!!line} onOpenChange={open => { if (!open && !busy) setLine(null) }}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content onCloseAutoFocus={event => {
          event.preventDefault()
          const target = !received.current && returnTrigger.current?.isConnected
            ? returnTrigger.current
            : globalThis.document.getElementById(`expand-${document.id}`)
          target?.focus()
        }} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-foreground">
          <Dialog.Title className="text-lg font-semibold">รับคืนพัสดุ</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">{line?.item_name} · {line?.asset_no} การรับคืนนี้มีผลเฉพาะรายการที่เลือก</Dialog.Description>
          <form onSubmit={receive} className="mt-4 space-y-4">
            <label className="block text-sm">สภาพพัสดุ<select value={condition} onChange={event => setCondition(event.target.value as ItemCondition)} disabled={busy} className="mt-1 block w-full rounded-md border border-input bg-background p-2"><option value="normal">ปกติ</option><option value="damaged">ชำรุด</option><option value="lost">สูญหาย</option></select></label>
            <label className="block text-sm">หมายเหตุ<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} disabled={busy} className="mt-1 block w-full rounded-md border border-input bg-background p-2" /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Dialog.Close asChild><Button type="button" variant="outline" disabled={busy}>ยกเลิก</Button></Dialog.Close><Button type="submit" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'ยืนยันรับคืน'}</Button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
