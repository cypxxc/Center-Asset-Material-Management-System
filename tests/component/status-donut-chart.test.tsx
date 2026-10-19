import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, fireEvent } from '@testing-library/react'
import { StatusDonutChart, type StatusItemData } from '../../components/dashboard/status-donut-chart'

const mockData: StatusItemData[] = [
  { key: 'active', label: 'ใช้งานปกติ', qty: 80, pct: 80, color: '#10b981' },
  { key: 'spare', label: 'สำรองในคลัง', qty: 20, pct: 20, color: '#3b82f6' },
  { key: 'damaged', label: 'ชำรุด', qty: 0, pct: 0, color: '#ef4444' },
]

test('StatusDonutChart renders total quantity and "ทั้งหมด" by default', () => {
  const { container } = render(
    <StatusDonutChart totalQuantity={100} statusData={mockData} />
  )
  assert.ok(container.textContent?.includes('ทั้งหมด'))
  assert.ok(container.textContent?.includes('100 ชิ้น'))
})

test('StatusDonutChart filters out zero-quantity segments in SVG', () => {
  const { container } = render(
    <StatusDonutChart totalQuantity={100} statusData={mockData} />
  )
  // Total circles = 1 background circle + 2 active non-zero segments = 3 circles
  const circles = container.querySelectorAll('svg circle')
  assert.equal(circles.length, 3)
})

test('StatusDonutChart renders legend items as Links with /items?status=... hrefs and titles', () => {
  const { container } = render(
    <StatusDonutChart totalQuantity={100} statusData={mockData} />
  )

  const links = container.querySelectorAll('a')
  assert.equal(links.length, 3)

  assert.equal(links[0].getAttribute('href'), '/items?status=active')
  assert.equal(links[0].getAttribute('title'), 'ดูรายการพัสดุสถานะ ใช้งานปกติ')
  assert.ok(links[0].textContent?.includes('ใช้งานปกติ'))
  assert.ok(links[0].textContent?.includes('(80%)'))

  assert.equal(links[1].getAttribute('href'), '/items?status=spare')
  assert.equal(links[1].getAttribute('title'), 'ดูรายการพัสดุสถานะ สำรองในคลัง')
  assert.ok(links[1].textContent?.includes('สำรองในคลัง'))
  assert.ok(links[1].textContent?.includes('(20%)'))

  assert.equal(links[2].getAttribute('href'), '/items?status=damaged')
  assert.equal(links[2].getAttribute('title'), 'ดูรายการพัสดุสถานะ ชำรุด')
  assert.ok(links[2].textContent?.includes('ชำรุด'))
  assert.ok(links[2].textContent?.includes('(0%)'))
})

test('StatusDonutChart updates center readout on segment hover', () => {
  const { container } = render(
    <StatusDonutChart totalQuantity={100} statusData={mockData} />
  )

  // Segments are circles (index 0 is track, index 1 is first active segment)
  const segments = container.querySelectorAll('svg circle')
  const activeSegment = segments[1] // 'active' segment

  fireEvent.mouseEnter(activeSegment)

  assert.ok(container.textContent?.includes('ใช้งานปกติ'))
  assert.ok(container.textContent?.includes('80 ชิ้น'))
  assert.ok(container.textContent?.includes('(80.0%)'))

  fireEvent.mouseLeave(activeSegment)

  assert.ok(container.textContent?.includes('ทั้งหมด'))
  assert.ok(container.textContent?.includes('100 ชิ้น'))
})

test('StatusDonutChart updates center readout on legend hover', () => {
  const { container } = render(
    <StatusDonutChart totalQuantity={100} statusData={mockData} />
  )

  const legendLinks = container.querySelectorAll('a')
  const spareLink = legendLinks[1] // 'spare' item

  fireEvent.mouseEnter(spareLink)

  assert.ok(container.textContent?.includes('สำรองในคลัง'))
  assert.ok(container.textContent?.includes('20 ชิ้น'))
  assert.ok(container.textContent?.includes('(20.0%)'))

  fireEvent.mouseLeave(spareLink)

  assert.ok(container.textContent?.includes('ทั้งหมด'))
  assert.ok(container.textContent?.includes('100 ชิ้น'))
})
