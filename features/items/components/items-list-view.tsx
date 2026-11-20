'use client'

import React, { useRef, useEffect, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Check, Copy, Package } from 'lucide-react'
import {
 DataTable,
 DataTableHeader,
 DataTableHead,
 DataTableBody,
 DataTableRow,
 DataTableCell,
} from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { type ItemListRow, type ItemListSearchParams } from '@/features/items/types'
import { ascSortColumns, type ItemSortColumn } from '@/features/items/list-params'
import { cn } from '@/lib/utils'
import { ItemThumbnail } from './item-thumbnail'
import { CategoryBadge } from './category-badge'
import { formatDateThaiBE } from '@/lib/date'
import { MaterialsList } from '@/features/materials/materials-list'
import { TruncatedTextTooltip } from '@/components/ui/truncated-text-tooltip'

export interface ItemsListProps {
 items: (ItemListRow | null | undefined)[]
 density?: 'comfortable' | 'compact'
 startIndex?: number
 topSpace?: number
 bottomSpace?: number
 selectedItemId: string | null
 selectedItemIds: string[]
 onSelect: (item: ItemListRow) => void
 onToggleSelectItem: (id: string) => void
 onToggleSelectAll: () => void
 allLoadedSelected: boolean
 params: ItemListSearchParams
 onToggleSort: (field: string) => void
 isInspectorOpen?: boolean
 userCanWrite?: boolean
 onCopy?: (value: string | null | undefined) => void
 onPrint?: (item: ItemListRow) => void
 onEdit?: (item: ItemListRow) => void
 mode?: 'standard' | 'ledger' | 'material'
 onUpdateStatus?: (itemId: string, status: ItemListRow['status']) => Promise<void> | void
}



export function ItemsList({
 items,
 density = 'compact',
 startIndex = 0,
 allLoadedSelected,
 selectedItemId,
 selectedItemIds,
 onSelect,
 onToggleSelectItem,
 onToggleSelectAll,
 params,
 onToggleSort,
 isInspectorOpen = false,
 userCanWrite = false,
 onCopy,
 mode = 'standard',
 onUpdateStatus,
}: ItemsListProps) {
 const masterCheckboxRef = useRef<HTMLInputElement>(null)

 useEffect(() => {
 if (masterCheckboxRef.current) {
 masterCheckboxRef.current.indeterminate = selectedItemIds.length > 0 && !allLoadedSelected
 }
 }, [selectedItemIds.length, allLoadedSelected])

 if (mode === 'material') {
 return <MaterialsList items={items} startIndex={startIndex} selectedItemId={selectedItemId}
 selectedItemIds={selectedItemIds} onSelect={onSelect} onToggleSelectItem={onToggleSelectItem}
 onToggleSelectAll={onToggleSelectAll} allLoadedSelected={allLoadedSelected}
 params={params} onToggleSort={onToggleSort} userCanWrite={userCanWrite} />
 }

 const renderSortHeader = (field: string, label: string, align: 'left' | 'center' | 'right' = 'left') => {
 const isSorted = Boolean(params.sort_by && params.sort_by === field)
 const currentDir = isSorted ? (params.sort_dir || 'asc') : null

 const isAscDefault = ascSortColumns.includes(field as ItemSortColumn)
 const initialDir: 'asc' | 'desc' = isAscDefault ? 'asc' : 'desc'
 const oppositeDir: 'asc' | 'desc' = initialDir === 'asc' ? 'desc' : 'asc'

 let nextActionText = ''
 if (!isSorted) {
 nextActionText = initialDir === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'
 } else if (currentDir === initialDir) {
 nextActionText = oppositeDir === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'
 } else {
 nextActionText = 'ยกเลิกการจัดเรียง (กลับสู่ค่าเริ่มต้น)'
 }

 const currentSortText = isSorted
 ? (currentDir === 'asc' ? 'กำลังเรียงจากน้อยไปมาก' : 'กำลังเรียงจากมากไปน้อย')
 : 'ยังไม่ได้จัดเรียง'

 const ariaLabel = `จัดเรียงตาม ${label} (${currentSortText}, กดเพื่อ${nextActionText})`
 const alignClass = align === 'center' ? 'justify-center w-full' : align === 'right' ? 'justify-end w-full' : 'justify-start w-full'

 return (
 <button
 type="button"
 onClick={() => onToggleSort(field)}
 aria-label={ariaLabel}
 title={ariaLabel}
 className={cn(
 "flex items-center gap-1 hover:text-card-foreground text-muted-foreground transition-colors font-bold uppercase cursor-pointer select-none",
 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
 isSorted && "text-foreground",
 alignClass
 )}
 >
 <span>{label}</span>
 {isSorted ? (
 currentDir === 'asc' ? (
 <ArrowUp className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
 ) : (
 <ArrowDown className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
 )
 ) : (
 <ArrowUpDown className="w-3 h-3 text-muted-foreground/50 shrink-0" aria-hidden="true" />
 )}
 </button>
 )
 }

 const getSortAria = (field: string): 'ascending' | 'descending' | 'none' => {
 if (!params.sort_by || params.sort_by !== field) return 'none'
 return params.sort_dir === 'asc' ? 'ascending' : 'descending'
 }

 const isLedger = mode === 'ledger'

 return (
 <div className="bg-muted/10 min-w-0 w-full">
 {isLedger && (
 <div className="sr-only print:not-sr-only print:block bg-card/90 border-b border-border/80 px-4 py-3 text-xs">
 <div>
 <h3 className="font-bold text-sm text-foreground">
 ทะเบียนคุมสินทรัพย์
 </h3>
 <p className="text-muted-foreground text-[11px] mt-0.5">บัญชีแสดงรายการวัสดุคงเหลือ (ครุภัณฑ์ตามเกณฑ์)</p>
 </div>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-[11px] mt-1">
 <span><strong className="text-foreground">หน่วยงาน:</strong> สำนักงานเขตสุขภาพที่ 7</span>
 <span><strong className="text-foreground">หมวด:</strong> {params.category_id ? 'ตามตัวกรอง' : 'ครุภัณฑ์ทั้งหมด'}</span>
 </div>
 </div>
 )}
 <DataTable
 responsive={false}
 wrapperClassName={cn(
 "border-0 rounded-none bg-transparent shadow-none min-w-0",
 isLedger ? "overflow-visible w-full" : "w-full"
 )}
 className={cn(
 "text-card-foreground table-fixed min-w-0",
 isLedger
 ? "w-full min-w-[1476px]"
 : isInspectorOpen
 ? "w-full min-w-[420px] xl:min-w-[640px] 2xl:min-w-[840px]"
 : "w-full min-w-[480px] sm:min-w-[640px] md:min-w-[768px] xl:min-w-[960px]"
 )}
 >
 <caption className="sr-only">รายการทะเบียนวัสดุและครุภัณฑ์</caption>
 {isLedger && (
 <colgroup>
 {userCanWrite && <col style={{ width: '40px' }} />}
 <col style={{ width: '48px' }} />
 <col style={{ width: '300px' }} />
 <col style={{ width: '112px' }} />
 <col style={{ width: '224px' }} />
 <col style={{ width: '96px' }} />
 <col style={{ width: '64px' }} />
 <col style={{ width: '176px' }} />
 <col style={{ width: '144px' }} />
 <col style={{ width: '144px' }} />
 <col style={{ width: '128px' }} />
 </colgroup>
 )}
 <DataTableHeader className="bg-muted/75 backdrop-blur-xs border-b border-border/80 sticky top-0 z-10 [&_th]:text-center [&_th>button]:w-full [&_th>button]:justify-center">
 {isLedger ? (
 <>
 <tr>
 {userCanWrite && (
<DataTableHead isCheckbox className="w-10 px-3 align-middle">
 <input
 ref={masterCheckboxRef}
 type="checkbox"
 aria-label="เลือกทุกรายการที่โหลดอยู่"
 checked={allLoadedSelected}
 onChange={onToggleSelectAll}
 className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
 />
 </DataTableHead>
)}
 <DataTableHead className="w-12 px-2 text-center align-middle font-bold text-muted-foreground">ลำดับ</DataTableHead>
 <DataTableHead className="w-[300px] min-w-[280px] max-w-[320px] px-3 align-middle font-bold text-muted-foreground" aria-sort={getSortAria('item_name')}>
 {renderSortHeader('item_name', 'รายการครุภัณฑ์')}
 </DataTableHead>
 <DataTableHead className="w-28 px-2 text-center align-middle font-bold text-muted-foreground" aria-sort={getSortAria('acquired_date')}>
 {renderSortHeader('acquired_date', 'วัน เดือน ปีที่รับ', 'center')}
 </DataTableHead>
 <DataTableHead className="w-56 px-2.5 align-middle font-bold text-muted-foreground">ยี่ห้อ/รุ่น</DataTableHead>
 <DataTableHead className="w-24 px-2.5 text-right align-middle font-bold text-muted-foreground" aria-sort={getSortAria('unit_price')}>
 {renderSortHeader('unit_price', 'ราคา', 'right')}
 </DataTableHead>
 <DataTableHead className="w-16 px-2 text-center align-middle font-bold text-muted-foreground">หน่วย</DataTableHead>
 <DataTableHead className="w-44 px-2.5 align-middle font-bold text-muted-foreground" aria-sort={getSortAria('asset_no')}>
 {renderSortHeader('asset_no', 'เลขครุภัณฑ์')}
 </DataTableHead>
 <DataTableHead className="w-36 px-2.5 align-middle font-bold text-muted-foreground" aria-sort={getSortAria('responsible_person')}>
 {renderSortHeader('responsible_person', 'ผู้ครอบครอง')}
 </DataTableHead>
 <DataTableHead className="w-36 px-2.5 align-middle font-bold text-muted-foreground">ใช้งานที่</DataTableHead>
 <DataTableHead className="w-32 px-2.5 text-center font-bold text-muted-foreground">สภาพวัสดุ</DataTableHead>
 </tr>
 </>
 ) : (
 <tr>
 {userCanWrite && (
<DataTableHead isCheckbox className="w-10 px-3">
 <input
 ref={masterCheckboxRef}
 type="checkbox"
 aria-label="เลือกทุกรายการที่โหลดอยู่"
 checked={allLoadedSelected}
 onChange={onToggleSelectAll}
 className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
 />
 </DataTableHead>
)}
 <DataTableHead className="w-11 px-1" />
 <DataTableHead className="w-[300px] min-w-[280px] max-w-[320px] px-3" aria-sort={getSortAria('item_name')}>{renderSortHeader('item_name', 'ชื่อสิ่งของ')}</DataTableHead>
 <DataTableHead className={cn("hidden w-36 px-2.5", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")} aria-sort={getSortAria('category')}>{renderSortHeader('category', 'หมวดหมู่')}</DataTableHead>
 <DataTableHead className="w-20 sm:w-24 px-2 sm:px-2.5 text-right" aria-sort={getSortAria('quantity')}>{renderSortHeader('quantity', 'จำนวน', 'right')}</DataTableHead>
 <DataTableHead className={cn("w-28 xl:w-32 px-2.5", isInspectorOpen ? "hidden xl:table-cell" : "hidden sm:table-cell")}>สถานที่</DataTableHead>
 <DataTableHead className={cn("hidden w-28 xl:w-32 px-2.5", isInspectorOpen ? "2xl:table-cell" : "xl:table-cell")}>ผู้รับผิดชอบ</DataTableHead>
 <DataTableHead className="w-24 sm:w-28 px-2 sm:px-3" aria-sort={getSortAria('status')}>{renderSortHeader('status', 'สถานะ')}</DataTableHead>
 </tr>
 )}
 </DataTableHeader>
 <DataTableBody className="divide-y divide-border/40 bg-transparent">
 {items.map((item, index) => {
 if (!item) return null
 return (
 <ItemTableRow
 key={item.id}
 item={item}
 index={startIndex + index}
 density={density}
 isSelected={selectedItemId === item.id}
 isChecked={selectedItemIds.includes(item.id)}
 onSelect={onSelect}
 onToggleSelectItem={onToggleSelectItem}
 isInspectorOpen={isInspectorOpen}
 userCanWrite={userCanWrite}
 onCopy={onCopy}
 mode={mode}
 onUpdateStatus={onUpdateStatus}
 />
 )
 })}
 {!items.length && <EmptyRows colSpan={isLedger ? (userCanWrite ? 11 : 10) : 8} />}
 </DataTableBody>
 </DataTable>
 </div>
 )
}

export interface ItemTableRowProps {
 item: ItemListRow
 index?: number
 density?: 'comfortable' | 'compact'
 isSelected: boolean
 isChecked: boolean
 onSelect: (item: ItemListRow) => void
 onToggleSelectItem: (id: string) => void
 isInspectorOpen?: boolean
 userCanWrite?: boolean
 onCopy?: (value: string | null | undefined) => void
 onPrint?: (item: ItemListRow) => void
 onEdit?: (item: ItemListRow) => void
 mode?: 'standard' | 'ledger'
 onUpdateStatus?: (itemId: string, status: ItemListRow['status']) => Promise<void> | void
}

export const ItemTableRow = React.memo(function ItemTableRow({
 item,
 index = 0,
 density = 'comfortable',
 isSelected,
 isChecked,
 onSelect,
 onToggleSelectItem,
 isInspectorOpen,
 userCanWrite = false,
 onCopy,
 mode = 'standard',
}: ItemTableRowProps) {
 const [copied, setCopied] = useState(false)
 const isCompact = density === 'compact'
 const isLedger = mode === 'ledger'
 const assetCode = item.asset_no || item.serial_no
 const brandModel = [item.brand, item.model].filter(Boolean).join(' ')

 const isUsable = item.status === 'active' || item.status === 'spare'
 const isDamaged = item.status === 'damaged' || item.status === 'waiting_repair'
 const isDeteriorated = item.status === 'inactive' || item.status === 'disposed'

 const handleCopy = (e: React.MouseEvent) => {
 e.stopPropagation()
 if (!assetCode) return
 onCopy?.(assetCode)
 setCopied(true)
 setTimeout(() => setCopied(false), 1500)
 }

 const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
 if (event.target !== event.currentTarget) return
 if (event.key === 'Enter') {
 onSelect(item)
 } else if (event.key === 'ArrowDown') {
 event.preventDefault()
 const nextRow = (event.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null
 nextRow?.focus()
 } else if (event.key === 'ArrowUp') {
 event.preventDefault()
 const prevRow = (event.currentTarget as HTMLElement).previousElementSibling as HTMLElement | null
 prevRow?.focus()
 }
 }

 return (
 <DataTableRow
 tabIndex={0}
 onKeyDown={handleKeyDown}
 onClick={() => onSelect(item)}
 className={cn(
 'group cursor-pointer transition-colors outline-none focus-visible:bg-muted/70 focus-visible:ring-1 focus-visible:ring-primary/50',
 isCompact
 ? 'h-[42px] max-h-[42px] [&>td]:h-[42px] [&>td]:max-w-0 [&>td]:truncate [&>td]:py-0'
 : 'h-[64px] max-h-[64px] [&>td]:h-[64px] [&>td]:max-w-0 [&>td]:truncate [&>td]:py-0',
 isSelected
 ? 'border-b border-primary/40 bg-primary/10 text-card-foreground shadow-2xs'
 : 'border-b border-border/40 text-card-foreground hover:bg-muted/40'
 )}
 >
 {/* Checkbox Column */}
 {userCanWrite && (
<DataTableCell isCheckbox className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 aria-label={`เลือก ${item.item_name}`}
 checked={isChecked}
 onChange={() => onToggleSelectItem(item.id)}
 className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
 />
 </DataTableCell>
)}

 {isLedger ? (
 <>
 {/* ลำดับ (Index) */}
 <DataTableCell className="w-12 px-2 text-center text-xs font-mono text-muted-foreground tabular-nums">
 {index + 1}
 </DataTableCell>

 {/* รายการครุภัณฑ์ (Asset Name) */}
 <DataTableCell className="w-[300px] min-w-[280px] max-w-[320px] px-3 overflow-hidden">
 <div className="flex items-center gap-2.5 min-w-0 w-full">
 <ItemThumbnail
 imageUrl={item.image_url}
 itemName={item.item_name}
 itemType={item.item_type}
 size="sm"
 className={isCompact ? "h-7 w-7 rounded shrink-0" : "h-8 w-8 rounded shrink-0"}
 showZoom={!isCompact}
 />
 <div className="flex flex-col justify-center min-w-0 flex-1 w-full overflow-hidden">
 {/* 1. Item name MUST occupy its own full-width row */}
 <div className="w-full min-w-0">
 <TruncatedTextTooltip
 text={item.item_name}
 as="span"
 className="truncate text-xs font-normal text-foreground hover:text-primary transition-colors block w-full leading-tight cursor-pointer"
 />
 </div>

 {/* Keep Serial Number when available */}
 {item.serial_no && (
 <div className="w-full min-w-0 mt-0.5">
 <TruncatedTextTooltip
 text={`s/n: ${item.serial_no}`}
 as="span"
 className="truncate font-mono text-[10px] text-muted-foreground block leading-tight"
 />
 </div>
 )}
 </div>
 </div>
 </DataTableCell>

 {/* วัน เดือน ปีที่รับ */}
 <DataTableCell className="w-28 px-2 text-center text-xs font-mono text-muted-foreground truncate">
 {formatDateThaiBE(item.acquired_date)}
 </DataTableCell>

 {/* ยี่ห้อ/รุ่น */}
 <DataTableCell className="w-56 px-2.5 text-xs text-muted-foreground truncate">
 <div className="truncate">
 {brandModel ? (
 <TruncatedTextTooltip
 text={brandModel}
 as="span"
 className="text-foreground truncate block"
 />
 ) : (
 <span className="text-foreground">-</span>
 )}
 {item.serial_no && (
 <TruncatedTextTooltip
 text={`s/n: ${item.serial_no}`}
 as="span"
 className="text-[11px] font-mono text-muted-foreground/80 block truncate"
 />
 )}
 </div>
 </DataTableCell>

 {/* ราคา */}
 <DataTableCell className="w-24 px-2.5 text-right font-mono text-xs tabular-nums text-foreground">
 {item.unit_price !== null && item.unit_price !== undefined
 ? Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
 : '-'}
 </DataTableCell>

 {/* หน่วย */}
 <DataTableCell className="w-16 px-2 text-center text-xs text-muted-foreground truncate">
 {item.unit?.name ? (
 <TruncatedTextTooltip
 text={item.unit.name}
 as="span"
 className="truncate block"
 />
 ) : '-'}
 </DataTableCell>

 {/* เลขครุภัณฑ์ */}
 <DataTableCell className="w-44 px-2.5 font-mono text-xs text-foreground truncate" title={item.asset_no || undefined}>
 {item.asset_no ? (
 <button
 type="button"
 onClick={handleCopy}
 title={`คัดลอก ${item.asset_no}`}
 aria-label={`คัดลอก ${item.asset_no}`}
 className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer group/badge truncate max-w-full"
 >
 <TruncatedTextTooltip
 text={item.asset_no}
 as="span"
 className="truncate"
 />
 {copied ? <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> : <Copy className="w-2.5 h-2.5 opacity-40 group-hover/badge:opacity-100 shrink-0" />}
 </button>
 ) : (
 <span className="text-muted-foreground/40 italic">-</span>
 )}
 </DataTableCell>

 {/* ผู้ครอบครอง */}
 <DataTableCell className="w-36 px-2.5 text-xs text-foreground truncate">
 {item.responsible_person ? (
 <TruncatedTextTooltip
 text={item.responsible_person}
 as="span"
 className="truncate block"
 />
 ) : '-'}
 </DataTableCell>

 {/* ใช้งานที่ */}
 <DataTableCell className="w-36 px-2.5 text-xs text-muted-foreground truncate">
 {item.location?.name ? (
 <TruncatedTextTooltip
 text={item.location.name}
 as="span"
 className="truncate block"
 />
 ) : '-'}
 </DataTableCell>

 {/* สภาพวัสดุ */}
 <DataTableCell className="w-32 px-2.5 text-center text-xs">
 <span className="inline-flex items-center gap-1.5 text-card-foreground">
 <span
 className={cn(
 "h-1.5 w-1.5 rounded-full shrink-0",
 isUsable ? "bg-emerald-500" : isDamaged ? "bg-rose-500" : "bg-slate-400"
 )}
 aria-hidden="true"
 />
 {isUsable ? 'ใช้งานได้' : isDamaged ? 'ชำรุด' : isDeteriorated ? 'เสื่อมสภาพ' : '-'}
 </span>
 </DataTableCell>

 </>
 ) : (
 <>
 {/* Visual Thumbnail */}
 <DataTableCell className="w-11 px-1">
 <ItemThumbnail
 imageUrl={item.image_url}
 itemName={item.item_name}
 itemType={item.item_type}
 size="sm"
 className={isCompact ? "h-7 w-7 rounded-md" : undefined}
 showZoom={!isCompact}
 />
 </DataTableCell>

 {/* Primary Item Name & Details Column */}
 <DataTableCell className="w-[300px] min-w-[280px] max-w-[320px] px-3 overflow-hidden">
 {isCompact ? (
 <div className="flex flex-col justify-center min-w-0 flex-1 w-full overflow-hidden pr-2">
 {/* 1. Item name MUST occupy its own full-width row */}
 <div className="w-full min-w-0">
 <TruncatedTextTooltip
 text={item.item_name}
 as="span"
 className="truncate text-xs font-normal text-foreground hover:text-primary transition-colors block w-full leading-tight cursor-pointer"
 />
 </div>
 {/* Keep Serial Number and identifiers when available */}
 <div className="mt-0.5 flex items-center gap-1.5 min-w-0 text-[11px] leading-none">
 {item.asset_no ? (
 <button
 type="button"
 onClick={handleCopy}
 title={`คัดลอก ${item.asset_no}`}
 aria-label={`คัดลอก ${item.asset_no}`}
 className="inline-flex items-center gap-1 rounded bg-muted/80 hover:bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/90 border border-border/70 shrink-0 transition-colors cursor-pointer group/badge"
 >
 <span className="truncate max-w-[120px]">{item.asset_no}</span>
 {copied ? (
 <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
 ) : (
 <Copy className="w-2.5 h-2.5 opacity-60 group-hover/badge:opacity-100 group-focus-within/badge:opacity-100 transition-opacity shrink-0" />
 )}
 </button>
 ) : (
 <span className="text-[10px] text-muted-foreground/50 italic shrink-0">
 ไม่มีเลขครุภัณฑ์
 </span>
 )}

 {item.serial_no && (
 <TruncatedTextTooltip
 text={`s/n: ${item.serial_no}`}
 as="span"
 className="truncate font-mono text-muted-foreground text-[10.5px] shrink-0"
 />
 )}

 {brandModel && (
 <TruncatedTextTooltip
 text={`• ${brandModel}`}
 as="span"
 className="truncate text-muted-foreground text-[10.5px] leading-none"
 />
 )}
 </div>
 </div>
 ) : (
 <div className="flex flex-col justify-center min-w-0 flex-1 w-full overflow-hidden pr-2">
 {/* 1. Item name MUST occupy its own full-width row */}
 <div className="w-full min-w-0">
 <TruncatedTextTooltip
 text={item.item_name}
 as="span"
 className="truncate text-xs font-normal text-foreground hover:text-primary transition-colors block w-full leading-5 cursor-pointer"
 />
 </div>

 {/* Keep Serial Number and identifiers when available */}
 <div className="mt-1 flex items-center gap-2 min-w-0 text-xs leading-none">
 {item.asset_no ? (
 <button
 type="button"
 onClick={handleCopy}
 title={`คัดลอก ${item.asset_no}`}
 aria-label={`คัดลอก ${item.asset_no}`}
 className="inline-flex items-center gap-1 rounded bg-muted/80 hover:bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/90 border border-border/70 shrink-0 max-w-full transition-colors cursor-pointer group/badge"
 >
 <span className="truncate">{item.asset_no}</span>
 {copied ? (
 <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
 ) : (
 <Copy className="w-2.5 h-2.5 opacity-60 group-hover/badge:opacity-100 group-focus-within/badge:opacity-100 transition-opacity shrink-0" />
 )}
 </button>
 ) : (
 <span className="text-[11px] font-medium text-muted-foreground/60 italic shrink-0">
 ไม่มีเลขครุภัณฑ์
 </span>
 )}

 {item.serial_no && (
 <TruncatedTextTooltip
 text={`s/n: ${item.serial_no}`}
 as="span"
 className="truncate font-mono text-muted-foreground text-[11px] shrink-0"
 />
 )}

 {brandModel && (
 <TruncatedTextTooltip
 text={`• ${brandModel}`}
 as="span"
 className="truncate text-muted-foreground text-[11.5px] leading-none"
 title={brandModel}
 />
 )}
 </div>
 </div>
 )}
 </DataTableCell>

 {/* Category Column */}
 <DataTableCell className={cn("hidden w-36 px-2.5 text-xs text-muted-foreground truncate", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")}>
 {item.category ? (
 <CategoryBadge name={item.category.name} color={item.category.color} icon={item.category.icon} />
 ) : (
 <span className="text-muted-foreground/50">-</span>
 )}
 </DataTableCell>

 {/* Quantity & Unit Column */}
 <DataTableCell className="w-20 sm:w-24 px-2 sm:px-2.5 text-right">
 <div className="flex items-baseline justify-end gap-1.5 w-full min-w-0">
 <span className="font-extrabold text-foreground text-sm tabular-nums text-right flex-1 min-w-0">
 {item.quantity}
 </span>
 {item.unit?.name ? (
 <TruncatedTextTooltip
 text={item.unit.name}
 as="span"
 className="text-xs font-normal text-muted-foreground truncate w-8 sm:w-10 text-left shrink-0"
 />
 ) : null}
 </div>
 </DataTableCell>

 {/* Location Column */}
 <DataTableCell
 className={cn(
 "w-28 xl:w-32 px-2.5 text-xs font-medium text-muted-foreground truncate",
 isInspectorOpen ? "hidden xl:table-cell" : "hidden sm:table-cell"
 )}
 title={item.location?.name || undefined}
 >
 {item.location?.name ? (
 <TruncatedTextTooltip
 text={item.location.name}
 as="span"
 className="truncate block"
 />
 ) : (
 <span className="text-muted-foreground/50">-</span>
 )}
 </DataTableCell>

 {/* Responsible Person Column */}
 <DataTableCell
 className={cn(
 "hidden w-28 xl:w-32 px-2.5 text-xs font-medium text-muted-foreground truncate",
 isInspectorOpen ? "2xl:table-cell" : "xl:table-cell"
 )}
 title={item.responsible_person || undefined}
 >
 {item.responsible_person ? (
 <TruncatedTextTooltip
 text={item.responsible_person}
 as="span"
 className="truncate block"
 />
 ) : (
 <span className="text-muted-foreground/50">-</span>
 )}
 </DataTableCell>

 {/* Status Column */}
 <DataTableCell className="w-24 sm:w-28 px-2 sm:px-3">
 <div className="flex flex-col gap-1 items-start">
 <StatusBadge status={item.status} size="sm" showDot className="shrink-0" />
 {item.is_central && (
 <span className={cn(
 "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap",
 item.is_borrowed
 ? "bg-amber-500/10 text-amber-700 border-amber-500/25"
 : "bg-emerald-500/10 text-emerald-700 border-emerald-500/25"
 )}>
 <span className={cn("size-1 rounded-full", item.is_borrowed ? "bg-amber-500" : "bg-emerald-500")} />
 {item.is_borrowed ? "ถูกยืม" : "พร้อมยืม"}
 </span>
 )}
 </div>
 </DataTableCell>
 </>
 )}
 </DataTableRow>
 )
})

function EmptyRows({ colSpan = 9 }: { colSpan?: number }) {
 return (
 <tr>
 <td colSpan={colSpan} className="px-5 py-12">
 <EmptyState
 title="ไม่พบข้อมูลสิ่งของ"
 description="ลองล้างตัวกรองหรือขึ้นทะเบียนรายการใหม่"
 icon={<Package className="h-10 w-10 text-muted-foreground opacity-60" />}
 className="border-0 shadow-none bg-transparent"
 />
 </td>
 </tr>
 )
}
