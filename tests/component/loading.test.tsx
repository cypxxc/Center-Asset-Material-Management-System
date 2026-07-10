import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { LoadingOverlay } from '../../components/ui/loading-overlay';

test('LoadingSpinner renders correctly', () => {
  const { container } = render(React.createElement(LoadingSpinner));
  const svg = container.querySelector('svg');
  assert.ok(svg);
  assert.ok(svg.classList.contains('animate-spin'));
});

test('LoadingOverlay renders loading text and spinner', () => {
  render(React.createElement(LoadingOverlay));
  assert.ok(screen.getByText('กำลังโหลดข้อมูล...'));
});
