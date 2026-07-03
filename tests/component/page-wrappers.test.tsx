import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PageContainer, PageSection, PageToolbar } from '../../components/ui/page-container';
import { PageHeader } from '../../components/ui/page-header';

test('PageContainer renders children and applies max-width class', () => {
  const { container } = render(React.createElement(PageContainer, { maxWidth: '7xl' }, 'Content'));
  assert.ok(screen.getByText('Content'));
  assert.ok(container.querySelector('.max-w-7xl'));
});

test('PageSection renders text', () => {
  render(React.createElement(PageSection, null, 'Section Content'));
  assert.ok(screen.getByText('Section Content'));
});

test('PageToolbar renders content', () => {
  render(React.createElement(PageToolbar, null, 'Toolbar Item'));
  assert.ok(screen.getByText('Toolbar Item'));
});

test('PageHeader renders title, subtitle, and action buttons', () => {
  const actionBtn = React.createElement('button', null, 'New Item');
  render(React.createElement(PageHeader, {
    title: 'Asset List',
    subtitle: 'Track corporate assets',
    actions: actionBtn
  }));

  assert.ok(screen.getByText('Asset List'));
  assert.ok(screen.getByText('Track corporate assets'));
  assert.ok(screen.getByRole('button', { name: 'New Item' }));
});
