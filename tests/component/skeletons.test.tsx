import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from '@testing-library/react';
import { SkeletonTable } from '../../components/ui/skeleton-table';
import { SkeletonCard } from '../../components/ui/skeleton-card';

test('SkeletonTable renders requested rows and cols', () => {
  const { container } = render(React.createElement(SkeletonTable, { rows: 4, cols: 3 }));
  const rows = container.querySelectorAll('.divide-y > div');
  assert.equal(rows.length, 4);

  // In each row, there should be 3 cols
  const cols = rows[0].querySelectorAll('.bg-slate-100');
  assert.equal(cols.length, 3);
});

test('SkeletonCard renders correctly', () => {
  const { container } = render(React.createElement(SkeletonCard));
  const card = container.querySelector('.animate-pulse');
  assert.ok(card);
});
