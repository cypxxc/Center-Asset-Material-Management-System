import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from '@testing-library/react';
import DashboardLoading from '../../app/(dashboard)/dashboard/loading';
import ItemsLoading from '../../app/(dashboard)/items/loading';

test('DashboardLoading exists and renders a skeleton layout with pulse animations', () => {
  const { container } = render(React.createElement(DashboardLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'DashboardLoading should render elements with animate-pulse');
});

test('ItemsLoading exists and renders a skeleton table layout with pulse animations', () => {
  const { container } = render(React.createElement(ItemsLoading));
  const pulseElements = container.querySelectorAll('.animate-pulse');
  assert.ok(pulseElements.length > 0, 'ItemsLoading should render elements with animate-pulse');
});
