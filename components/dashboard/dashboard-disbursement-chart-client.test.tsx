import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DashboardDisbursementChartClient } from './dashboard-disbursement-chart-client'
import type { CompletedDisbursementSummary } from '@/features/reports/completed-disbursement-series'

Object.assign(globalThis, {
  getComputedStyle: window.getComputedStyle.bind(window),
  MutationObserver: window.MutationObserver,
  Element: window.Element,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  HTMLInputElement: window.HTMLInputElement,
  NodeFilter: window.NodeFilter,
  Node: window.Node,
})

const summary: CompletedDisbursementSummary = { asOf: '2026-11-17', unrecordedHandoverCount: 2,
  months: [{ year: 2025, month: 10, borrowed: 3, issued: 2 }, { year: 2026, month: 10, borrowed: 1, issued: 4 }] }

test('chart filters update totals, accessible bars, and the monthly table together', () => {
  render(React.createElement(DashboardDisbursementChartClient, { summary }))
  assert.ok(screen.getByRole('heading', { name: 'ยอดรวมการยืมและเบิกที่สำเร็จ' }))
  assert.equal((screen.getByLabelText('เลือกปีของการยืมและเบิก') as HTMLSelectElement).value, '')
  fireEvent.change(screen.getByLabelText('เลือกปีของการยืมและเบิก'), { target: { value: '' } })
  assert.ok(screen.getByText('รวม 10 ครั้ง'))
  assert.equal(screen.getAllByRole('img', { name: /ครั้ง/ }).length, 2)
  assert.ok(screen.getByRole('img', { name: 'ปีปฏิทิน 2568: ยืม 3 ครั้ง · เบิก 2 ครั้ง · รวม 5 ครั้ง' }))
  assert.ok(within(screen.getByRole('table')).getByRole('columnheader', { name: 'ปี' }))
  assert.ok(screen.getByText(/ยังไม่มีวันที่ส่งมอบจริง 2 รายการ/))
  assert.ok(screen.getByText(/กราฟใช้วันที่อนุมัติแทนเมื่อมีข้อมูล/))
  fireEvent.change(screen.getByLabelText('เลือกประเภทปีของการยืมและเบิก'), { target: { value: 'fiscal' } })
  fireEvent.change(screen.getByLabelText('เลือกปีของการยืมและเบิก'), { target: { value: '2026' } })
  assert.ok(screen.getByText('รวม 5 ครั้ง'))
  const bar = screen.getByRole('img', { name: 'ตุลาคม 2568: ยืม 3 ครั้ง · เบิก 2 ครั้ง · รวม 5 ครั้ง' })
  fireEvent.focus(bar)
  assert.ok(screen.getAllByText('ตุลาคม 2568: ยืม 3 ครั้ง · เบิก 2 ครั้ง · รวม 5 ครั้ง').length > 0)
  fireEvent.click(screen.getByText('ดูตารางข้อมูล'))
  const table = screen.getByRole('table')
  assert.ok(within(table).getByRole('row', { name: 'ตุลาคม 2568 3 2 5' }))
  assert.ok(within(table).getByRole('row', { name: 'รวม 3 2 5' }))
})

test('opens all years by default even when activity only exists in a past year', async () => {
  render(React.createElement(DashboardDisbursementChartClient, { summary: { ...summary,
    months: [{ year: 2024, month: 9, borrowed: 2, issued: 1 }] } }))
  assert.equal((screen.getByLabelText('เลือกปีของการยืมและเบิก') as HTMLSelectElement).value, '')
  assert.ok(await screen.findByRole('button', { name: 'ทุกปี', exact: true }))
  assert.ok(screen.getByText('รวม 3 ครั้ง'))
  assert.equal(screen.getAllByRole('img', { name: /ครั้ง/ }).length, 1)
})

test('empty chart explains the absence of successful transactions', () => {
  render(React.createElement(DashboardDisbursementChartClient, { summary: { ...summary, months: [], unrecordedHandoverCount: 0 } }))
  assert.ok(screen.getByText('รวม 0 ครั้ง'))
  assert.ok(screen.getByText('ยังไม่มีรายการยืมหรือเบิกที่สำเร็จในช่วงนี้'))
  assert.equal(screen.queryByRole('group', { name: /กราฟแท่งซ้อน/ }), null)
})

test('visible year dropdown switches between annual totals and monthly detail', async () => {
  render(React.createElement(DashboardDisbursementChartClient, { summary }))
  assert.ok(await screen.findByRole('button', { name: 'ทุกปี', exact: true }))
  fireEvent.change(screen.getByLabelText('เลือกปีของการยืมและเบิก'), { target: { value: '2026' } })
  const yearButton = await screen.findByRole('button', { name: '2569', exact: true })
  fireEvent.keyDown(yearButton, { key: 'Enter', code: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: 'ทุกปี', exact: true }))
  assert.ok(await screen.findByRole('button', { name: 'ทุกปี', exact: true }))
  assert.equal(screen.getAllByRole('img', { name: /ครั้ง/ }).length, 2)
  assert.ok(screen.getByText('รวม 10 ครั้ง'))
  fireEvent.keyDown(screen.getByRole('button', { name: 'ทุกปี', exact: true }), { key: 'Enter', code: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '2568', exact: true }))
  assert.ok(screen.getByRole('button', { name: '2568', exact: true }))
  assert.equal(screen.getAllByRole('img', { name: /ครั้ง/ }).length, 12)
  assert.ok(screen.getByText('รวม 5 ครั้ง'))
})

test('switching to fiscal years selects an available year instead of retaining an empty calendar year', () => {
  render(React.createElement(DashboardDisbursementChartClient, { summary: { ...summary,
    months: [{ year: 2026, month: 10, borrowed: 1, issued: 4 }] } }))
  fireEvent.change(screen.getByLabelText('เลือกปีของการยืมและเบิก'), { target: { value: '2026' } })
  fireEvent.change(screen.getByLabelText('เลือกประเภทปีของการยืมและเบิก'), { target: { value: 'fiscal' } })
  assert.equal((screen.getByLabelText('เลือกปีของการยืมและเบิก') as HTMLSelectElement).value, '2027')
  assert.ok(screen.getByText('รวม 5 ครั้ง'))
})
