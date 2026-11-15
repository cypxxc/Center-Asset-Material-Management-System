'use client'

import { Fragment, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { formatDate, isDateReachedInBangkok } from '@/lib/date'
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell } from '@/components/ui/data-table'
import { DisbursementStatusBadge, DisbursementTypeBadge } from './badges'
import { ApprovalRowActions } from './approval-row-actions'
import { DueBorrowReturnAction } from './due-borrow-return-action'
import { TransactionItemsTable } from './transaction-items-table'
import type { DisbursementRow } from '../types'

export function GroupedTransactionsTable({ documents, userRole, historyMode = false }: { documents: DisbursementRow[]; userRole: string; historyMode?: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggleDetails(id: string) {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  return <DataTable wrapperClassName="disbursement-table-scroll border-0 rounded-none" className="min-w-[1000px] [&_tr>th:last-child]:pr-6 [&_tr>td:last-child]:pr-6">
    <DataTableHeader><tr>
      <DataTableHead className="w-12"><span className="sr-only">ขยายรายการ</span></DataTableHead>
      <DataTableHead>ชื่อผู้ขอ</DataTableHead>
      <DataTableHead className="text-right">จำนวน</DataTableHead><DataTableHead>วันที่</DataTableHead><DataTableHead>สถานะ</DataTableHead><DataTableHead isActions className="w-48 text-center">จัดการ</DataTableHead>
    </tr></DataTableHeader>
    <DataTableBody>{documents.map(doc => {
      const open = expanded.has(doc.id)
      const requestNumber = doc.request_number?.padStart(3, '0') || doc.document_no || doc.id
      const typeLabel = doc.transaction_type === 'asset_borrow' ? 'ยืม' : 'เบิก'
      const reference = `${typeLabel} ${requestNumber}`
      const requesterName = doc.requester_name || doc.recipient_name || 'ไม่ระบุชื่อ'
      return <Fragment key={doc.id}>
        <DataTableRow
          tabIndex={historyMode ? 0 : undefined}
          aria-expanded={historyMode ? open : undefined}
          aria-controls={historyMode && open ? `transaction-${doc.id}` : undefined}
          className={historyMode ? `align-middle cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${open ? 'bg-primary/10' : ''}` : 'align-middle'}
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
          <DataTableCell className="w-12"><button id={`expand-${doc.id}`} type="button" aria-label={`${open ? 'ย่อ' : 'ขยาย'}รายการ ${reference}`} aria-expanded={open} aria-controls={`transaction-${doc.id}`} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => toggleDetails(doc.id)}><ChevronRight aria-hidden="true" className={`h-4 w-4 ${open ? 'rotate-90' : ''}`} /></button></DataTableCell>
          <DataTableCell className="whitespace-normal"><div className="inline-flex items-center gap-2 text-foreground"><DisbursementTypeBadge type={doc.transaction_type} label={typeLabel} /><span className="text-xs break-words">{requesterName}</span></div></DataTableCell>
          <DataTableCell className="text-right tabular-nums">{doc.requested_items?.length || 0} รายการ</DataTableCell>
          <DataTableCell className="tabular-nums text-xs"><div className="space-y-1">{doc.transaction_type === 'asset_borrow' ? <><div>ยืม {formatDate(doc.confirmed_at || doc.created_at)}</div><div className="text-muted-foreground">คืน {doc.due_date ? formatDate(doc.due_date) : 'ไม่ระบุ'}</div></> : formatDate(doc.confirmed_at || doc.created_at)}</div></DataTableCell>
          <DataTableCell><DisbursementStatusBadge status={doc.status} /></DataTableCell>
          <DataTableCell isActions className="w-48 text-center"><div className="flex items-center justify-center gap-2">
            {userRole === 'admin' && doc.transaction_type === 'asset_borrow' && ['active_borrow', 'partially_returned'].includes(doc.status) && isDateReachedInBangkok(doc.due_date)
              && <DueBorrowReturnAction disbursementId={doc.id} />}
            {userRole === 'admin' && <ApprovalRowActions doc={doc} />}
          </div></DataTableCell>
        </DataTableRow>
        {open && <DataTableRow hoverable={false}><DataTableCell colSpan={6} className="!p-0 whitespace-normal"><div id={`transaction-${doc.id}`} role="region" aria-label={`พัสดุ ${reference}`} className="border-y border-border bg-muted/20 px-6 py-4">
          <dl className="mb-3 flex flex-wrap gap-x-8 gap-y-2 text-xs"><div><dt className="inline text-muted-foreground">วัตถุประสงค์: </dt><dd className="inline break-words">{doc.purpose || '—'}</dd></div></dl>
          {doc.status === 'rejected' && <p className="mb-3 whitespace-pre-wrap break-words text-sm text-destructive"><strong>เหตุผลที่ไม่อนุมัติ: </strong>{doc.reversal_reason || 'ไม่อนุมัติคำขอ'}</p>}
          <TransactionItemsTable document={doc} userRole={userRole} />
        </div></DataTableCell></DataTableRow>}
      </Fragment>
    })}</DataTableBody>
  </DataTable>
}
