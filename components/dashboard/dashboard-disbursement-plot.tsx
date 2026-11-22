'use client'

import { useEffect, useRef, useState } from 'react'
import type { CompletedDisbursementPeriod } from '@/features/reports/completed-disbursement-series'
import { DashboardChartTooltip } from './dashboard-chart-tooltip'

const number = new Intl.NumberFormat('th-TH')
function periodLabel(period: CompletedDisbursementPeriod) {
  return `${period.fullLabel}: ${period.future ? 'ยังไม่ถึงช่วงเวลา' : `ยืม ${number.format(period.borrowed)} ครั้ง · เบิก ${number.format(period.issued)} ครั้ง · รวม ${number.format(period.total)} ครั้ง`}`
}

export function DashboardDisbursementPlot({ periods, annual = false }: { periods: CompletedDisbursementPeriod[]; annual?: boolean }) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(640)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => setContainerWidth(container.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  const active = periods.find(period => period.key === activeKey)
  const width = Math.max(640, containerWidth, periods.length * 66 + 56)
  const slot = (width - 64) / periods.length
  const step = Math.max(1, Math.ceil(Math.max(...periods.map(period => period.total)) / 4))
  const scale = 128 / (step * 4)
  return <div>
    <p className="mb-1 text-[11px] text-muted-foreground">จำนวนครั้งที่ยืมและเบิกสำเร็จ</p>
    <div ref={containerRef} role="region" aria-label={`กราฟการยืมและเบิก${annual ? 'รายปี เลื่อนแนวนอนเพื่อดูทุกปี' : 'รายเดือน เลื่อนแนวนอนเพื่อดูทุกเดือน'}`} tabIndex={0}
      className="relative overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring">
      <svg role="group" aria-label={`กราฟแท่งซ้อนจำนวนครั้งที่ยืมและเบิกสำเร็จตาม${annual ? 'ปี' : 'เดือน'}ที่ส่งมอบหรืออนุมัติ`}
        viewBox={`0 0 ${width} 190`} style={{ minWidth: width }} width={width} height={190} className="block text-muted-foreground">
        {[0, 1, 2, 3, 4].map(index => <g key={index} aria-hidden="true">
          <line x1={48} x2={width - 8} y1={148 - index * 32} y2={148 - index * 32} className="stroke-border" strokeDasharray={index ? '3 5' : undefined} />
          <text x={38} y={152 - index * 32} textAnchor="end" fill="currentColor" fontSize={11}>{number.format(step * index)}</text>
        </g>)}
        {periods.map((period, index) => {
          const x = 48 + index * slot
          const barWidth = Math.min(28, slot - 12)
          return <g key={period.key}>
            {!period.future && <g aria-hidden="true">
              <rect x={x + (slot - barWidth) / 2} y={148 - period.borrowed * scale} width={barWidth} height={period.borrowed * scale} className="fill-primary" />
              <rect x={x + (slot - barWidth) / 2} y={148 - period.total * scale} width={barWidth} height={period.issued * scale} className="fill-muted-foreground stroke-foreground" strokeWidth={period.issued ? 0.5 : 0} />
            </g>}
            <text x={x + slot / 2} y={period.future ? 142 : 142 - period.total * scale}
              textAnchor="middle" fill="currentColor" fontSize={11} fontWeight={period.total ? 600 : 400} aria-hidden="true">
              {period.future ? '—' : number.format(period.total)}
            </text>
            <rect x={x + 1} y={4} width={slot - 2} height={150} rx={3} tabIndex={0} role="img" aria-label={periodLabel(period)}
              className="fill-transparent outline-none focus-visible:stroke-ring focus-visible:stroke-2"
              onFocus={() => setActiveKey(period.key)} onBlur={() => setActiveKey(null)}
              onMouseEnter={() => setActiveKey(period.key)} onMouseLeave={() => setActiveKey(null)} />
            <text x={x + slot / 2} y={168} textAnchor="middle" fill="currentColor" fontSize={11} aria-hidden="true">{period.label}</text>
            {!annual && <text x={x + slot / 2} y={183} textAnchor="middle" fill="currentColor" fontSize={10} aria-hidden="true">{Number(period.key.split('-')[0]) + 543}</text>}
          </g>
        })}
      </svg>
      {active && <DashboardChartTooltip
        title={active.fullLabel}
        value={active.future ? undefined : number.format(active.total)}
        unit="ครั้ง"
        items={[
          ...(active.borrowed > 0 ? [{ label: 'ยืม', value: number.format(active.borrowed), unit: 'ครั้ง', colorClass: 'bg-primary' }] : []),
          ...(active.issued > 0 ? [{ label: 'เบิก', value: number.format(active.issued), unit: 'ครั้ง', colorClass: 'bg-muted-foreground' }] : []),
        ]}
        note={active.future ? 'ยังไม่ถึงช่วงเวลา' : undefined}
        x={48 + (periods.indexOf(active) + 0.5) * slot}
        y={148 - active.total * scale}
        containerWidth={width}
        containerHeight={190}
      />}
    </div>
    <p aria-live="polite" aria-atomic="true" className="min-h-4 text-[11px] leading-4 text-muted-foreground">{active ? periodLabel(active) : null}</p>
  </div>
}
