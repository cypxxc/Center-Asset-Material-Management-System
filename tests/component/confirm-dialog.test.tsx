import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';

test('ConfirmDialog renders title and description when open', () => {
  render(React.createElement(ConfirmDialog, {
    open: true,
    title: 'Delete Item',
    description: 'Are you sure you want to delete this?',
    onConfirm: () => {},
    onCancel: () => {}
  }));

  assert.ok(screen.getByText('Delete Item'));
  assert.ok(screen.getByText('Are you sure you want to delete this?'));
});

test('ConfirmDialog is null when closed', () => {
  const { container } = render(React.createElement(ConfirmDialog, {
    open: false,
    title: 'Delete Item',
    description: 'Are you sure?',
    onConfirm: () => {},
    onCancel: () => {}
  }));

  assert.equal(container.innerHTML, '');
});

test('ConfirmDialog clicks trigger callbacks', () => {
  let confirmed = false;
  let cancelled = false;

  render(React.createElement(ConfirmDialog, {
    open: true,
    title: 'Delete Item',
    description: 'Are you sure?',
    onConfirm: () => { confirmed = true; },
    onCancel: () => { cancelled = true; }
  }));

  const cancelBtn = screen.getByRole('button', { name: 'ยกเลิก' });
  const confirmBtn = screen.getByRole('button', { name: 'ยืนยัน' });

  fireEvent.click(cancelBtn);
  assert.equal(cancelled, true);

  fireEvent.click(confirmBtn);
  assert.equal(confirmed, true);
});
