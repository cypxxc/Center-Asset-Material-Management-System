import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { StatusDonutChart, StatusItemData } from '../../components/dashboard/status-donut-chart';

const mockData: StatusItemData[] = [
  { key: 'good', label: 'ดีมาก', qty: 80, pct: 80, color: '#10b981' },
  { key: 'fair', label: 'พอใช้', qty: 20, pct: 20, color: '#f59e0b' },
  { key: 'broken', label: 'ชำรุด', qty: 0, pct: 0, color: '#ef4444' },
];

test('StatusDonutChart renders total quantity by default', () => {
  const { container } = render(
    React.createElement(StatusDonutChart, { totalQuantity: 100, statusData: mockData })
  );
  assert.ok(container.textContent?.includes('100'));
  assert.ok(container.textContent?.includes('ชิ้นงานรวม'));
});

test('StatusDonutChart filters out zero-quantity segments in SVG', () => {
  const { container } = render(
    React.createElement(StatusDonutChart, { totalQuantity: 100, statusData: mockData })
  );
  // Total circles = 1 background circle + 2 active non-zero segments = 3 circles
  const circles = container.querySelectorAll('svg circle');
  assert.equal(circles.length, 3);
});

test('StatusDonutChart renders all legend items', () => {
  const { container } = render(
    React.createElement(StatusDonutChart, { totalQuantity: 100, statusData: mockData })
  );
  assert.ok(container.textContent?.includes('ดีมาก (80%)'));
  assert.ok(container.textContent?.includes('พอใช้ (20%)'));
  assert.ok(container.textContent?.includes('ชำรุด (0%)'));
});

test('StatusDonutChart updates center text on legend hover', () => {
  const { container } = render(
    React.createElement(StatusDonutChart, { totalQuantity: 100, statusData: mockData })
  );

  const legendItem = container.querySelectorAll('.grid > div')[0];
  fireEvent.mouseEnter(legendItem);

  assert.ok(container.textContent?.includes('80'));
  assert.ok(container.textContent?.includes('ดีมาก (80%)'));

  fireEvent.mouseLeave(legendItem);
  assert.ok(container.textContent?.includes('ชิ้นงานรวม'));
});
