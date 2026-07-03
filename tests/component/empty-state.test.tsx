import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../../components/ui/empty-state';

test('EmptyState renders title and description', () => {
  render(React.createElement(EmptyState, {
    title: 'No Data Found',
    description: 'Try adjusting your search queries.'
  }));

  assert.ok(screen.getByText('No Data Found'));
  assert.ok(screen.getByText('Try adjusting your search queries.'));
});

test('EmptyState renders action buttons when provided', () => {
  const actionBtn = React.createElement('button', null, 'Reset Filters');
  render(React.createElement(EmptyState, {
    title: 'No Data',
    action: actionBtn
  }));

  assert.ok(screen.getByRole('button', { name: 'Reset Filters' }));
});
