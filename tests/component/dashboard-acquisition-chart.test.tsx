import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, fireEvent } from '@testing-library/react'
import { DashboardAcquisitionChartClient } from '../../components/dashboard/dashboard-acquisition-chart-client'
import type { AcquisitionSummary } from '../../features/reports/acquisition-series'

const summary: AcquisitionSummary = {
  asOf: '2026-11-12', missingDateCount: 0, futureDateCount: 0,
  months: [
    { year: 2025, month: 9, recordCount: 2, knownValue: 200, missingPriceCount: 0 },
    { year: 2025, month: 10, recordCount: 3, knownValue: 300, missingPriceCount: 0 },
    { year: 2026, month: 1, recordCount: 5, knownValue: 500, missingPriceCount: 0 },
  ],
}

test('switching convention preserves the selected year and metric while updating its date range and totals', () => {
  const view = render(<DashboardAcquisitionChartClient summary={summary} showMetricSelect />)
  fireEvent.change(view.getByLabelText('เลือกปี'), { target: { value: '2025' } })
  fireEvent.change(view.getByLabelText('เลือกข้อมูลที่แสดง'), { target: { value: 'value' } })
  assert.ok(view.container.textContent?.includes('500 บาท'))
  fireEvent.change(view.getByLabelText('เลือกประเภทปี'), { target: { value: 'fiscal' } })
  assert.equal((view.getByLabelText('เลือกปี') as HTMLSelectElement).value, '2025')
  assert.equal((view.getByLabelText('เลือกข้อมูลที่แสดง') as HTMLSelectElement).value, 'value')
  assert.ok(view.container.textContent?.includes('ปีงบประมาณ 2568 · 1 ต.ค. 2567 – 30 ก.ย. 2568'))
  assert.ok(view.container.textContent?.includes('200 บาท'))
  fireEvent.change(view.getByLabelText('เลือกประเภทปี'), { target: { value: '' } })
  assert.equal((view.getByLabelText('เลือกปี') as HTMLSelectElement).value, '2025')
  assert.ok(view.container.textContent?.includes('ปีปฏิทิน 2568 · 1 ม.ค. 2568 – 31 ธ.ค. 2568'))
})

test('a selected year with no records in the new convention stays selected and displays an empty state', () => {
  const octoberOnly = { ...summary, months: [summary.months[1]] }
  const view = render(<DashboardAcquisitionChartClient summary={octoberOnly} />)
  fireEvent.change(view.getByLabelText('เลือกปี'), { target: { value: '2025' } })
  fireEvent.change(view.getByLabelText('เลือกประเภทปี'), { target: { value: 'fiscal' } })
  const year = view.getByLabelText('เลือกปี') as HTMLSelectElement
  assert.equal(year.value, '2025')
  assert.equal(year.selectedOptions[0].textContent, '2568')
  assert.ok(view.container.textContent?.includes('ยังไม่มีรายการที่ระบุวันที่ได้มาในช่วงนี้'))
})

test('all-years mode stays selected and explains the convention without changing the total', () => {
  const view = render(<DashboardAcquisitionChartClient summary={summary} />)
  assert.ok(view.container.textContent?.includes('ปีปฏิทิน · ทุกปีที่มีข้อมูล (ม.ค.–ธ.ค.)'))
  fireEvent.change(view.getByLabelText('เลือกประเภทปี'), { target: { value: 'fiscal' } })
  assert.equal((view.getByLabelText('เลือกปี') as HTMLSelectElement).value, '')
  assert.ok(view.container.textContent?.includes('ปีงบประมาณ · ทุกปีที่มีข้อมูล (ต.ค.–ก.ย.)'))
  assert.ok(view.container.textContent?.includes('10 รายการ'))
})
