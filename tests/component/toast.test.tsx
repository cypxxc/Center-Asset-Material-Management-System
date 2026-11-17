import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../../components/ui/toast';

function ToastTestButton() {
  const { toast } = useToast();
  return React.createElement('button', {
    onClick: () => toast('This is a success message', 'success', 5000)
  }, 'Trigger Toast');
}

test('ToastProvider and useToast display toast card', () => {
  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ToastTestButton)
    )
  );

  const triggerBtn = screen.getByText('Trigger Toast');
  fireEvent.click(triggerBtn);

  // Assert toast message is rendered
  const toastMsg = screen.getByText('This is a success message');
  assert.ok(toastMsg);
});
