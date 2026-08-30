import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from '@testing-library/react';
import { StatusBadge } from '../../components/ui/status-badge';

test('StatusBadge renders the status label based on input status', () => {
  const { container } = render(React.createElement(StatusBadge, { status: 'active' }));
  const label = container.textContent;
  assert.ok(label?.includes('ใช้งานอยู่'));
});

test('StatusBadge accepts custom children as label', () => {
  const { container } = render(React.createElement(StatusBadge, null, 'Custom Label'));
  assert.ok(container.textContent?.includes('Custom Label'));
});

test('StatusBadge shows dot by default when showDot is true', () => {
  const { container } = render(React.createElement(StatusBadge, { status: 'active', showDot: true }));
  const dot = container.querySelector('.bg-current');
  assert.ok(dot);
});

test('StatusBadge hides dot when showDot is false', () => {
  const { container } = render(React.createElement(StatusBadge, { status: 'active', showDot: false }));
  const noDot = container.querySelector('.bg-current');
  assert.equal(noDot, null);
});
