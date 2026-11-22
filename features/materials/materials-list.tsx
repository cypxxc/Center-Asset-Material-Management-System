'use client'

import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell } from '@/components/ui/data-table'
import type { ItemsListProps } from '@/features/items/components/items-list-view'
import { ItemThumbnail } from '@/features/items/components/item-thumbnail'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'

export function MaterialsList({ items, startIndex = 0, selectedItemId, selectedItemIds, onSelect, onToggleSelectItem, onToggleSelectAll, allLoadedSelected, params, onToggleSort, userCanWrite }: ItemsListProps) {
  const checkbox = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = selectedItemIds.length > 0 && !allLoadedSelected
  }, [selectedItemIds.length, allLoadedSelected])
  const columns = [
    ['ลำดับ', null, 48], ['รายการวัสดุ', 'item_name', 300], ['รหัสวัสดุ', null, 176],
    ['หมวดหมู่', 'category', 176], ['คงเหลือ', 'quantity', 96], ['หน่วย', null, 64],
    ['ราคา/หน่วย (บาท)', 'unit_price', 128], ['สถานที่จัดเก็บ', null, 176], ['สถานะ', 'status', 128],
  ] as const
  return <div className="w-full min-w-0 bg-muted/10">
    <DataTable responsive={false} wrapperClassName="w-full overflow-visible rounded-none border-0 bg-transparent shadow-none" className="w-full min-w-[1332px] table-fixed text-card-foreground">
      <caption className="sr-only">ทะเบียนวัสดุ เลือกแถวเพื่อดูรายละเอียด</caption>
      <colgroup>{userCanWrite && <col style={{ width: 40 }} />}{columns.map(([label, , width]) => <col key={label} style={{ width }} />)}</colgroup>
      <DataTableHeader className="sticky top-0 z-10 border-b border-border/80 bg-muted/75 backdrop-blur-xs">
        <tr>{userCanWrite && <DataTableHead isCheckbox className="px-3"><input ref={checkbox} type="checkbox" checked={allLoadedSelected} onChange={onToggleSelectAll} aria-label="เลือกทุกรายการที่โหลดอยู่" className="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-ring" /></DataTableHead>}
          {columns.map(([label, field], index) => <DataTableHead key={label} className={cn('px-2.5 font-bold text-muted-foreground',
            [0, 5, 8].includes(index) ? 'text-center' : [4, 6].includes(index) ? 'text-right' : 'text-left',
            [0, 5].includes(index) && 'px-2', index === 1 && 'pl-[50px] pr-3',
          )} aria-sort={field ? params.sort_by === field ? params.sort_dir === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}>
            {field ? <button type="button" onClick={() => onToggleSort(field)} className={cn('flex w-full cursor-pointer items-center gap-1 rounded-sm text-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              [4, 6].includes(index) ? 'flex-row-reverse justify-start' : index === 8 ? 'justify-center' : 'justify-start',
            )} aria-label={`จัดเรียงตาม ${label}`}>
              {label}{params.sort_by === field ? params.sort_dir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" /> : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
            </button> : label}
          </DataTableHead>)}
        </tr>
      </DataTableHeader>
      <DataTableBody className="divide-y divide-border/40 bg-transparent">
        {items.map((item, index) => item && <DataTableRow key={item.id} tabIndex={0} onClick={() => onSelect(item)} onKeyDown={event => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Enter') onSelect(item)
        }} className={cn('group h-[42px] max-h-[42px] cursor-pointer border-b border-border/40 text-card-foreground outline-none hover:bg-muted/40 focus-visible:bg-muted/70 focus-visible:ring-1 focus-visible:ring-primary/50 [&>td]:h-[42px] [&>td]:py-0', selectedItemId === item.id && 'border-primary/40 bg-primary/10 shadow-2xs')}>
          {userCanWrite && <DataTableCell isCheckbox className="px-3" onClick={event => event.stopPropagation()}><input type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={() => onToggleSelectItem(item.id)} aria-label={`เลือก ${item.item_name}`} className="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-ring" /></DataTableCell>}
          <DataTableCell className="px-2 text-center font-mono text-xs tabular-nums text-muted-foreground">{startIndex + index + 1}</DataTableCell>
          <DataTableCell className="px-3 !whitespace-normal"><div className="flex min-w-0 items-center gap-2.5"><ItemThumbnail imageUrl={item.image_url} itemName={item.item_name} itemType="material" size="sm" className="h-7 w-7 shrink-0 rounded" showZoom={false} /><span className="min-w-0 break-words py-1 text-xs leading-tight">{item.item_name}</span></div></DataTableCell>
          <DataTableCell className="break-all px-2.5 font-mono text-xs !whitespace-normal">{item.material?.commodity_code || '—'}</DataTableCell>
          <DataTableCell className="px-2.5 text-xs text-muted-foreground !whitespace-normal">{item.category?.name || '—'}</DataTableCell>
          <DataTableCell className="px-2.5 text-right font-mono text-xs tabular-nums">{Number(item.quantity).toLocaleString('th-TH')}</DataTableCell>
          <DataTableCell className="px-2 text-center text-xs text-muted-foreground">{item.unit?.name || '—'}</DataTableCell>
          <DataTableCell className="px-2.5 text-right font-mono text-xs tabular-nums">{item.unit_price == null ? '—' : Number(item.unit_price).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</DataTableCell>
          <DataTableCell className="px-2.5 text-xs text-muted-foreground !whitespace-normal">{item.location?.name || '—'}</DataTableCell>
          <DataTableCell className="px-2.5 text-center text-xs"><StatusBadge status={item.status} size="sm" showDot /></DataTableCell>
        </DataTableRow>)}
        {!items.length && <DataTableRow><DataTableCell colSpan={userCanWrite ? 10 : 9} className="py-12 text-center text-muted-foreground">ไม่พบข้อมูลวัสดุ ลองล้างตัวกรองหรือขึ้นทะเบียนรายการใหม่</DataTableCell></DataTableRow>}
      </DataTableBody>
    </DataTable>
  </div>
}
