'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/date'
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell } from '@/components/ui/data-table'
import { cn } from '@/lib/utils'
import { DisbursementStatusBadge, DisbursementTypeBadge } from './badges'
import { ApprovalRowActions } from './approval-row-actions'
import { DueBorrowReturnAction } from './due-borrow-return-action'
import { TransactionItemsTable } from './transaction-items-table'
import type { DisbursementRow } from '../types'

export function GroupedTransactionsTable({
  documents,
  userRole,
  historyMode = false,
  maxRows,
  wrapperClassName,
}: {
  documents: DisbursementRow[]
  userRole: string
  historyMode?: boolean
  materialApprovalSlaHours?: number | null
  maxRows?: number
  wrapperClassName?: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [maxHeightStyle, setMaxHeightStyle] = useState<number | undefined>(undefined)
  const tableRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    if (!maxRows || documents.length <= maxRows) {
      return
    }
    const table = tableRef.current
    if (!table) return

    const measure = () => {
      const thead = table.querySelector('thead')
      const rows = table.querySelectorAll<HTMLElement>('tbody > tr[data-row="document"]')
      if (!thead || rows.length < maxRows) return

      let height = thead.offsetHeight
      for (let i = 0; i < maxRows && i < rows.length; i++) {
        height += rows[i].offsetHeight
      }
      if (height > 0) {
        setMaxHeightStyle(height)
      }
    }

    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure)
      observer.observe(table)
      return () => observer.disconnect()
    }
  }, [documents.length, maxRows])

  function toggleDetails(id: string) {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isScrollable = Boolean(maxRows && documents.length > maxRows)

  return <DataTable
    ref={tableRef}
    wrapperStyle={isScrollable && maxHeightStyle ? { maxHeight: `${maxHeightStyle}px` } : undefined}
    wrapperClassName={cn(
      "disbursement-table-scroll max-w-full overflow-x-auto",
      wrapperClassName ?? "min-w-0 rounded-none border-0 bg-transparent shadow-none",
      isScrollable && "overflow-y-auto max-h-[350px]"
    )}
    className="min-w-[840px] table-fixed text-xs text-card-foreground"
  >
    <colgroup>
      <col className="w-10" />
      <col className="w-[18%]" />
      <col className="w-[22%]" />
      <col className="w-[9%]" />
      <col className="w-[14%]" />
      <col className="w-[11%]" />
      <col className="w-[22%]" />
    </colgroup>
    <DataTableHeader className="border-border/80 bg-muted/75 backdrop-blur-xs [&>tr>th]:px-3 [&>tr>th:first-child]:px-2"><tr>
      <DataTableHead><span className="sr-only">ขยายรายการ</span></DataTableHead>
      <DataTableHead className="text-left">ชื่อผู้ขอ</DataTableHead>
      <DataTableHead className="text-left">วัตถุประสงค์</DataTableHead>
      <DataTableHead className="text-center">จำนวน</DataTableHead>
      <DataTableHead className="text-left">วันที่</DataTableHead>
      <DataTableHead className="text-center">สถานะ</DataTableHead>
      <DataTableHead isActions className="text-center">จัดการ</DataTableHead>
    </tr></DataTableHeader>
    <DataTableBody className="divide-border/40 bg-transparent">{documents.map(doc => {
      const open = expanded.has(doc.id)
      const requestNumber = doc.request_number?.padStart(3, '0') || doc.document_no || doc.id
      const typeLabel = doc.transaction_type === 'asset_borrow' ? 'ยืม' : 'เบิก'
      const reference = `${typeLabel} ${requestNumber}`
      const requesterName = doc.requester_name || doc.recipient_name || 'ไม่ระบุชื่อ'
      return <Fragment key={doc.id}>
        <DataTableRow
          data-row="document"
          tabIndex={historyMode ? 0 : undefined}
          aria-expanded={historyMode ? open : undefined}
          aria-controls={historyMode && open ? `transaction-${doc.id}` : undefined}
          className={cn(
            'h-[42px] border-b border-border/40 hover:bg-muted/40 [&>td]:px-3 [&>td]:py-1 [&>td:first-child]:px-2',
            historyMode && 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            open && 'bg-primary/5'
          )}
          onClick={event => {
            if (!historyMode) return
            if ((event.target as Element).closest('button, a, input, select, textarea, [role="button"], [role="menuitem"]')) return
            toggleDetails(doc.id)
          }}
          onKeyDown={event => {
            if (!historyMode) return
            if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
            event.preventDefault()
            toggleDetails(doc.id)
          }}
        >
          <DataTableCell className="w-10"><button id={`expand-${doc.id}`} type="button" aria-label={`${open ? 'ย่อ' : 'ขยาย'}รายการ ${reference}`} aria-expanded={open} aria-controls={`transaction-${doc.id}`} className={cn('flex size-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', open && 'border-primary/30 bg-primary/10 text-primary')} onClick={() => toggleDetails(doc.id)}><ChevronRight aria-hidden="true" className={cn('size-4 transition-transform', open && 'rotate-90')} /></button></DataTableCell>
          <DataTableCell className="whitespace-normal"><div className="flex items-center gap-2 text-foreground min-w-0"><DisbursementTypeBadge type={doc.transaction_type} label={typeLabel} /><span className="min-w-0 truncate font-medium" title={requesterName}>{requesterName}</span></div></DataTableCell>
          <DataTableCell className="text-left"><span className="block truncate text-muted-foreground" title={doc.purpose || '—'}>{doc.purpose || '—'}</span></DataTableCell>
          <DataTableCell className="text-center tabular-nums">{doc.requested_items?.length || 0} รายการ</DataTableCell>
          <DataTableCell className="tabular-nums text-xs"><div className="space-y-1">{doc.transaction_type === 'asset_borrow' ? <><div>ยืม {formatDate(doc.confirmed_at || doc.created_at)}</div><div className="text-muted-foreground">คืน {doc.due_date ? formatDate(doc.due_date) : 'ไม่ระบุ'}</div></> : formatDate(doc.confirmed_at || doc.created_at)}</div></DataTableCell>
          <DataTableCell className="text-center"><DisbursementStatusBadge status={doc.status} className="gap-1 px-2 text-[10.5px] leading-tight" /></DataTableCell>
          <DataTableCell isActions className="text-center"><div className="flex flex-wrap items-center justify-center gap-1.5">
            {userRole === 'admin' && doc.transaction_type === 'asset_borrow' && ['active_borrow', 'partially_returned'].includes(doc.status)
              && <DueBorrowReturnAction disbursementId={doc.id} />}
            {userRole === 'admin' && <ApprovalRowActions doc={doc} />}
          </div></DataTableCell>
        </DataTableRow>
        {open && <DataTableRow hoverable={false}><DataTableCell colSpan={7} className="whitespace-normal p-0"><div id={`transaction-${doc.id}`} role="region" aria-label={`วัสดุ ${reference}`} className="border-y border-border/80 bg-muted/30 p-2.5 sm:p-3">
          <TransactionItemsTable document={doc} userRole={userRole} reference={reference} />
        </div></DataTableCell></DataTableRow>}
      </Fragment>
    })}</DataTableBody>
  </DataTable>
}
