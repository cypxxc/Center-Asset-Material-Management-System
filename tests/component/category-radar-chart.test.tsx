import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from '@testing-library/react';
import { CategoryRadarChart, RadarCategoryItem } from '../../components/reports/category-radar-chart';

const mockRadarData: RadarCategoryItem[] = [
  { category: 'คอมพิวเตอร์และอุปกรณ์', totalQty: 50, activeQty: 45 },
  { category: 'เฟอร์นิเจอร์สำนักงาน', totalQty: 30, activeQty: 28 },
  { category: 'เครื่องใช้ไฟฟ้า', totalQty: 20, activeQty: 15 },
  { category: 'ยานพาหนะ', totalQty: 10, activeQty: 8 },
];

test('CategoryRadarChart alias renders combo chart with backward compatibility', () => {
  const { container } = render(
    React.createElement(CategoryRadarChart, {
      data: mockRadarData,
      totalValue: 500000,
      totalCount: 110,
      activeCount: 96,
    })
  );

  assert.ok(container.textContent?.includes('แผนภูมิแท่งและแนวโน้มเปรียบเทียบสัดส่วนตามหมวดหมู่'));
  assert.ok(container.textContent?.includes('500,000 บาท'));
  assert.ok(container.textContent?.includes('จำนวนทั้งหมด: 110'));
  assert.ok(container.textContent?.includes('พร้อมใช้งาน: 96'));
});
