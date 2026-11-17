import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { LoadingOverlay } from '../../components/ui/loading-overlay';
import { Preloader3D } from '../../components/ui/preloader-3d';

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

test('Preloader3D renders with label', () => {
  render(React.createElement(Preloader3D, { label: 'กำลังโหลด 3D...' }));
  assert.ok(screen.getByText('กำลังโหลด 3D...'));
});

test('LoadingOverlay with 3d variant renders 3d preloader', () => {
  render(React.createElement(LoadingOverlay, { variant: '3d', label: 'กำลังประมวลผล...' }));
  assert.ok(screen.getByText('กำลังประมวลผล...'));
});
