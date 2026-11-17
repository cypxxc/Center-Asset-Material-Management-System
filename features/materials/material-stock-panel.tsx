'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { loadMaterialStock, saveMaterialStock } from './stock-actions'

type Ledger = Extract<Awaited<ReturnType<typeof loadMaterialStock>>, { success: true }>['data']
const field = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring'
const labels: Record<string, string> = { receipt: 'รับเข้า', count: 'ปรับยอดตรวจนับ', opening: 'ยอดตั้งต้น', return: 'รับคืนวัสดุ' }

export function MaterialStockPanel({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [kind, setKind] = useState<'receipt' | 'count' | 'opening'>('receipt')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, startTransition] = useTransition()
  const [uncertain, setUncertain] = useState(false)
  const pendingCommand = useRef<Record<string, unknown> | null>(null)
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    let active = true
    loadMaterialStock(itemId).then(result => { if (active) { if (result.success) setLedger(result.data); else setError(result.error) } }).catch(() => { if (active) setError('โหลดบัญชีเคลื่อนไหวไม่สำเร็จ') })
    return () => { active = false }
  }, [itemId])
  async function reload() {
    try {
      const result = await loadMaterialStock(itemId)
      if (result.success) setLedger(result.data)
      else setError(result.error)
    } catch { setError('โหลดบัญชีเคลื่อนไหวไม่สำเร็จ') }
  }
  function submit(data: FormData) {
    pendingCommand.current ??= { item_id: itemId, request_key: crypto.randomUUID(), kind,
      quantity: kind === 'opening' ? 0 : data.get('quantity'), reason: data.get('reason'), reference: data.get('reference'),
      ...(kind === 'count' ? { expected_stock_version: ledger?.stock_version } : {}) }
    setError(''); setMessage('')
    startTransition(async () => {
      try {
        const result = await saveMaterialStock(pendingCommand.current)
        setUncertain(false)
        if (!result.success) { setError(result.error); return }
        pendingCommand.current = null
        setMessage('บันทึกเอกสารและบัญชีเคลื่อนไหวแล้ว')
        form.current?.reset()
        await reload(); router.refresh()
      } catch {
        setUncertain(true)
        setError('ยังไม่ได้รับผลยืนยัน กรุณาลองยืนยันรายการเดิมอีกครั้งก่อนเปลี่ยนข้อมูล')
      }
    })
  }
  return <section className="space-y-4 rounded-xl border border-border bg-card p-5" aria-label="รับเข้าและปรับยอดวัสดุ">
    <div><h2 className="font-semibold">รับเข้าและปรับยอดวัสดุ</h2><p className="mt-1 text-sm text-muted-foreground">บันทึกจำนวนพร้อมเหตุผลและเอกสารอ้างอิง การแก้ไขรายละเอียดวัสดุไม่เปลี่ยนยอดคงเหลือ</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
    {ledger && <div className="space-y-2 text-sm">
      <p>ยอดปัจจุบัน <strong className="tabular-nums">{ledger.quantity.toLocaleString('th-TH')}</strong></p>
      {ledger.reconciliation ? <p role="status" className={ledger.reconciliation.balanced ? 'text-muted-foreground' : 'text-destructive'}>
        {ledger.reconciliation.balanced ? 'ยอดตรงกับบัญชีเคลื่อนไหว' : `ยอดไม่ตรงกับบัญชี ต่าง ${ledger.reconciliation.difference} หน่วย กรุณาตรวจสอบหลักฐาน`}
        {' · '}ยอดตั้งต้น {ledger.opening_balance} + เคลื่อนไหวสุทธิ {ledger.movements} = {ledger.reconciliation.expected}
      </p> : <p className="text-muted-foreground">ยังไม่มีเอกสารยอดตั้งต้น กรุณาตรวจสอบหลักฐานก่อนบันทึกยอดตั้งต้นจากยอดปัจจุบัน</p>}
    </div>}
    <form ref={form} onSubmit={event => { event.preventDefault(); submit(new FormData(event.currentTarget)) }} onChange={() => { if (!uncertain) pendingCommand.current = null }} className="space-y-3">
      <fieldset disabled={busy || !ledger || uncertain} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">ประเภทเอกสาร<select className={field} value={kind} onChange={event => { setKind(event.target.value as typeof kind); if (!uncertain) pendingCommand.current = null }}>
          <option value="receipt">รับเข้า</option><option value="count">ปรับยอดตรวจนับ</option>{ledger && !ledger.reconciliation && <option value="opening">บันทึกยอดตั้งต้น</option>}
        </select></label>
        {kind !== 'opening' && <label className="text-sm">{kind === 'receipt' ? 'จำนวนรับเข้า' : 'จำนวนที่ตรวจนับได้'}<input name="quantity" className={field} type="number" min={kind === 'receipt' ? 1 : 0} max={2147483647} step={1} required /></label>}
        {kind === 'count' && <p className="text-xs text-muted-foreground sm:col-span-2">ใช้ยอดล่าสุดที่โหลดนี้เป็นจุดตรวจนับ หากยอดเปลี่ยนระหว่างทำงาน ระบบจะให้ตรวจนับใหม่</p>}
        <label className="text-sm">เหตุผล<input name="reason" className={field} required maxLength={500} /></label>
        <label className="text-sm">เอกสารอ้างอิง<input name="reference" className={field} required maxLength={500} /></label>
      </fieldset>
      <div className="flex gap-2"><button disabled={busy || !ledger} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? 'กำลังบันทึก…' : uncertain ? 'ลองยืนยันรายการเดิมอีกครั้ง' : 'บันทึกการเคลื่อนไหว'}</button>
        <button type="button" disabled={busy} onClick={() => { if (!uncertain && kind === 'count') pendingCommand.current = null; void reload() }} className="rounded-md border border-border px-4 py-2 text-sm">โหลดและตรวจนับใหม่</button></div>
    </form>
    {ledger && <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="pb-2 text-left font-medium">เอกสารเคลื่อนไหวล่าสุด (ไม่รวมเอกสารเบิกต้นฉบับ)</caption><thead><tr className="border-b border-border"><th className="p-2">เวลา / ผู้ทำ</th><th className="p-2">ประเภท</th><th className="p-2 text-right">เพิ่ม–ลด</th><th className="p-2">เหตุผล / อ้างอิง</th></tr></thead><tbody>{ledger.history.map(row => <tr key={row.id} className="border-b border-border/50"><td className="p-2">{new Date(row.created_at).toLocaleString('th-TH')}<br />{row.actor_name || '—'}</td><td className="p-2">{labels[row.kind] || row.kind}</td><td className="p-2 text-right tabular-nums">{row.kind === 'opening' ? '—' : row.delta > 0 ? `+${row.delta}` : row.delta}</td><td className="p-2">{row.reason}<br />{row.reference}</td></tr>)}</tbody></table></div>}
  </section>
}
