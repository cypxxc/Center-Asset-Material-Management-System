import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { CategoryComboChart, ComboCategoryItem } from '../../features/reports/components/category-combo-chart';

const mockComboData: ComboCategoryItem[] = [
  { category: 'คอมพิวเตอร์และอุปกรณ์', totalQty: 50, activeQty: 45 },
  { category: 'เฟอร์นิเจอร์สำนักงาน', totalQty: 30, activeQty: 28 },
  { category: 'เครื่องใช้ไฟฟ้า', totalQty: 20, activeQty: 15 },
  { category: 'ยานพาหนะ', totalQty: 10, activeQty: 8 },
];

test('CategoryComboChart renders title, totals, and legend', () => {
  const { container } = render(
    React.createElement(CategoryComboChart, { data: mockComboData })
  );

  assert.ok(container.textContent?.includes('แผนภูมิแท่งและแนวโน้มเปรียบเทียบสัดส่วนตามหมวดหมู่'));
  assert.ok(container.textContent?.includes('จำนวนทั้งหมด: 110'));
  assert.ok(container.textContent?.includes('พร้อมใช้งาน: 96'));
  assert.ok(container.textContent?.includes('อัตราความพร้อมใช้งาน (% Usability)'));
});

test('CategoryComboChart renders SVG bars, trend line, dots, and category labels', () => {
  const { container } = render(
    React.createElement(CategoryComboChart, { data: mockComboData })
  );

  const svg = container.querySelector('svg');
  assert.ok(svg !== null);

  // Check category labels rendered in SVG
  assert.ok(container.textContent?.includes('คอมพิวเตอร์และอุปกรณ์'));
  assert.ok(container.textContent?.includes('เฟอร์นิเจอร์สำนักงาน'));
  assert.ok(container.textContent?.includes('เครื่องใช้ไฟฟ้า'));
  assert.ok(container.textContent?.includes('ยานพาหนะ'));

  // SVG elements: rects (bars), polyline (trend line), circles (dots)
  const rects = container.querySelectorAll('svg rect');
  assert.ok(rects.length >= 8); // at least 4 total bars + 4 active bars

  const polyline = container.querySelector('svg polyline');
  assert.ok(polyline !== null);

  const circles = container.querySelectorAll('svg circle');
  assert.equal(circles.length, 4);

  // Check right Y-axis % labels
  assert.ok(container.textContent?.includes('100%'));
  assert.ok(container.textContent?.includes('0%'));
});

test('CategoryComboChart handles empty data gracefully', () => {
  const { container } = render(
    React.createElement(CategoryComboChart, { data: [] })
  );

  assert.ok(container.textContent?.includes('ไม่มีข้อมูลหมวดหมู่สำหรับแสดงผลแผนภูมิในขณะนี้'));
});

test('CategoryComboChart handles category hover interactions', () => {
  const { container } = render(
    React.createElement(CategoryComboChart, { data: mockComboData })
  );

  const detailItems = container.querySelectorAll('.space-y-2 > div');
  assert.equal(detailItems.length, 4);

  fireEvent.mouseEnter(detailItems[0]);
  assert.ok(container.textContent?.includes('กำลังเลือกดู'));

  fireEvent.mouseLeave(detailItems[0]);
  assert.ok(container.textContent?.includes('ชี้เพื่อดูเจาะจง'));
});

test('CategoryComboChart renders consolidated Top KPI strip when metrics provided', () => {
  const { container } = render(
    React.createElement(CategoryComboChart, {
      data: mockComboData,
      totalValue: 1250000,
      totalCount: 100,
      activeCount: 80,
    })
  );

  // Metric 1: Total Valuation
  assert.ok(container.textContent?.includes('มูลค่าทรัพย์สินทั้งหมด (Total Valuation)'));
  assert.ok(container.textContent?.includes('1,250,000 บาท'));
  assert.ok(container.textContent?.includes('คำนวณจากราคาต่อหน่วยที่บันทึกในทะเบียน'));

  // Metric 2: Active Rate
  assert.ok(container.textContent?.includes('สัดส่วนพัสดุพร้อมใช้งาน (Active Rate)'));
  assert.ok(container.textContent?.includes('80%'));
  assert.ok(container.textContent?.includes('80 / 100 รายการ'));
  assert.ok(container.textContent?.includes('พัสดุที่อยู่ในสถานะใช้งานปกติพร้อมปฏิบัติงาน'));
});

test('CategoryComboChart renders Top KPI strip even when data is empty', () => {
  const { container } = render(
    React.createElement(CategoryComboChart, {
      data: [],
      totalValue: 50000,
      totalCount: 10,
      activeCount: 5,
    })
  );

  assert.ok(container.textContent?.includes('มูลค่าทรัพย์สินทั้งหมด (Total Valuation)'));
  assert.ok(container.textContent?.includes('50,000 บาท'));
  assert.ok(container.textContent?.includes('สัดส่วนพัสดุพร้อมใช้งาน (Active Rate)'));
  assert.ok(container.textContent?.includes('50%'));
  assert.ok(container.textContent?.includes('5 / 10 รายการ'));
  assert.ok(container.textContent?.includes('ไม่มีข้อมูลหมวดหมู่สำหรับแสดงผลแผนภูมิในขณะนี้'));
});
