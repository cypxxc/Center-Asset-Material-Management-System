'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, History } from 'lucide-react'
import {
  buildAuditDiff,
  getAuditActionLabel,
} from '@/features/audit-log-display/format'
import type { ItemAuditLog } from '@/features/items/queries'

interface ItemAuditTimelineProps {
  logs: ItemAuditLog[]
}

const COLLAPSED_COUNT = 3

export function ItemAuditTimeline({ logs }: ItemAuditTimelineProps) {
  const [expanded, setExpanded] = useState(false)
  const visibleLogs = useMemo(
    () => expanded ? logs : logs.slice(0, COLLAPSED_COUNT),
    [expanded, logs],
  )
  const hiddenCount = Math.max(0, logs.length - COLLAPSED_COUNT)

  if (logs.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
        ประวัติการทำรายการและตรวจนับ (Audit Logs)
      </h3>
      <div className="flow-root">
        <ul className="-mb-8">
          {visibleLogs.map((log, logIdx) => {
            const diff = buildAuditDiff(log.old_data, log.new_data)
            const isLastVisible = logIdx === visibleLogs.length - 1

            return (
              <li key={log.id}>
                <div className="relative pb-8">
                  {!isLastVisible ? (
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center ring-8 ring-white">
                        <History className="h-4 w-4 text-blue-600" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-1.5 flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-800 font-bold">
                          {getAuditActionLabel(log.action)}{' '}
                          <span className="font-semibold text-slate-500">โดย {log.user_name}</span>
                        </p>
                        {diff.length > 0 ? (
                          <div className="mt-2 text-[11px] bg-slate-50 border border-slate-100 p-2 rounded-lg text-slate-600 max-h-32 overflow-y-auto space-y-1">
                            {diff.map((entry) => (
                              <div key={entry.key} className="leading-5">
                                <span className="font-bold text-slate-700">{entry.label}</span>
                                <span>: {entry.oldValue} → </span>
                                <span className="font-bold text-blue-600">{entry.newValue}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] text-slate-400">
                            ไม่มีรายละเอียดฟิลด์ที่เปลี่ยนแปลง
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-semibold">
                        {new Date(log.created_at).toLocaleString('th-TH')}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>{expanded ? 'ย่อรายการประวัติ' : `แสดงประวัติทั้งหมดอีก ${hiddenCount} รายการ`}</span>
        </button>
      )}
    </div>
  )
}
