'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { getPageNumbers } from '../pagination'
import { loadCustodyHistory } from '../actions'
import type { CustodyHistoryRow, getCustodyHistory } from '../custody-postgres'
import { AssetReturnModal } from './asset-return-modal'

export function CustodyHistoryPanel({ query, revision, onAssign }: { query: string; revision: number; onAssign?: () => void }) {
  return <CustodyHistoryPages key={JSON.stringify([query, revision])} query={query} onAssign={onAssign} />
}

function CustodyHistoryPages({ query, onAssign }: { query: string; onAssign?: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCustodyHistory>> | null>(null)
  const [selectedReturnItem, setSelectedReturnItem] = useState<CustodyHistoryRow | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    loadCustodyHistory({ page, q: query }).then((result) => {
      if (cancelled) return
      if (result.ok && result.data) { setData(result.data); setError('') }
      else setError(result.error || 'โหลดประวัติไม่สำเร็จ')
    }).catch(() => { if (!cancelled) setError('โหลดประวัติไม่สำเร็จ') })
    return () => { cancelled = true }
  }, [page, query, attempt])
  const q = query.trim()

  function changePage(next: number) {
    setData(null)
    setError('')
    setPage(next)
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background" aria-label="ประวัติมอบหมายผู้ถือครอง">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-12"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => { setError(''); setAttempt((value) => value + 1) }}>ลองใหม่</Button></div>
      ) : data === null ? (
        <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />กำลังโหลดประวัติ...</div>
      ) : data.rows.length ? (
        <div className="min-w-0">
          <table className="table-data-uniform w-full min-w-[880px] table-fixed text-left text-xs text-card-foreground">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[17%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-border/80 bg-muted/75 text-muted-foreground backdrop-blur-xs"><tr>
              {['ลำดับ', 'สิ่งของ', 'ผู้ถือครองเดิม', 'ผู้ถือครองใหม่', 'ผู้ทำรายการ', 'วันที่', 'จัดการ'].map((label) => (
                <th key={label} className={cn('px-3 py-3 font-semibold', (label === 'ลำดับ' || label === 'จัดการ') && 'text-center')}>{label}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-border/40">{data.rows.map((row, index) => (
              <tr key={row.id} className="h-[42px] border-b border-border/40 text-card-foreground transition-colors hover:bg-muted/40 [&>td]:h-[42px] [&>td]:max-w-0 [&>td]:px-3 [&>td]:py-0">
                <td className="text-center font-mono tabular-nums text-muted-foreground">{(data.page - 1) * data.pageSize + index + 1}</td>
                <td className="whitespace-normal break-words"><p className="font-medium">{row.item_name}</p><p className="break-all font-mono text-[11px] text-muted-foreground">{row.asset_no || 'ไม่ระบุเลขครุภัณฑ์'}</p></td>
                <td className="break-words">{row.from_responsible || 'ยังไม่กำหนด'}</td>
                <td className="break-words">{row.to_responsible || '-'}</td>
                <td className="break-words">{row.actor_name || '-'}</td>
                <td className="whitespace-nowrap text-left tabular-nums text-muted-foreground">{formatDateTime(row.created_at)}</td>
                <td className="text-center [&_span]:whitespace-normal">
                  {row.status_action === 'can_return' || row.can_return ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-primary/30 bg-primary/10 px-2.5 text-xs font-semibold text-primary hover:bg-primary/15"
                      onClick={() => setSelectedReturnItem(row)}
                    >
                      รับคืน
                    </Button>
                  ) : row.status_action === 'cancelled' ? (
                    <StatusBadge size="sm" variant="danger">ยกเลิก</StatusBadge>
                  ) : row.status_action === 'transferred' ? (
                    <StatusBadge size="sm" variant="muted">สิ้นสุดการถือครอง</StatusBadge>
                  ) : row.status_action === 'completed' ? (
                    <StatusBadge size="sm" variant="muted">สิ้นสุดรายการ</StatusBadge>
                  ) : row.status_action === 'returned' || row.is_returned ? (
                    <StatusBadge size="sm" variant="success">รับคืนแล้ว</StatusBadge>
                  ) : (
                    <StatusBadge size="sm" variant="muted">สิ้นสุดรายการ</StatusBadge>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          <p role="status" className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground shadow-xs sm:p-6">
            {q ? 'ไม่พบรายการตามคำค้นหา' : 'ไม่มีรายการสั่งจ่ายที่อยู่ระหว่างการถือครอง'}
          </p>
        </div>
      )}
      </div>
      <footer className="flex min-h-12 flex-wrap gap-3 py-2.5 shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground shadow-inner z-10 min-w-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <span aria-live="polite" className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-card-foreground shrink-0">
            {data ? data.total > 0 ? `แสดง ${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} จาก ${data.total.toLocaleString()} รายการ` : 'แสดง 0 จาก 0 รายการ' : error ? 'โหลดประวัติไม่สำเร็จ' : 'กำลังโหลดประวัติ...'}
          </span>
        </div>
        <nav aria-label="แบ่งหน้าประวัติผู้ถือครอง" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs font-semibold" aria-label="หน้าก่อนหน้า" disabled={!data || !!error || data.page <= 1} onClick={() => data && changePage(data.page - 1)}>ก่อนหน้า</Button>
          <div className="flex items-center gap-1">
            {getPageNumbers(data?.page ?? page, data?.totalPages ?? page).map((item, index) => item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-1.5 text-xs text-muted-foreground select-none" aria-hidden="true">…</span>
            ) : <button
              key={item}
              type="button"
              disabled={!data || !!error}
              onClick={() => { if (item !== data?.page) changePage(item) }}
              aria-current={item === (data?.page ?? page) ? 'page' : undefined}
              aria-label={`หน้า ${item}`}
              className={cn('flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring', item === (data?.page ?? page) ? 'border-primary/40 bg-primary/10 text-primary shadow-xs font-bold' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground')}
            >{item}</button>)}
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs font-semibold" aria-label="หน้าถัดไป" disabled={!data || !!error || data.page >= data.totalPages} onClick={() => data && changePage(data.page + 1)}>ถัดไป</Button>
        </nav>
      </footer>
      {selectedReturnItem && (
        <AssetReturnModal
          item={selectedReturnItem}
          onClose={() => setSelectedReturnItem(null)}
          onSuccess={() => {
            setSelectedReturnItem(null)
            setAttempt((value) => value + 1)
            onAssign?.()
          }}
        />
      )}
    </section>
  )
}
