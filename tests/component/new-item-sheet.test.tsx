import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewItemSheet } from '../../features/items/components/new-item-sheet';

test('NewItemSheet does not warn about unsaved changes when untouched', () => {
  const htmlDialogProto = window.HTMLDialogElement?.prototype as HTMLDialogElement | undefined;
  if (htmlDialogProto) {
    htmlDialogProto.showModal = function showModal() {
      this.open = true;
    };
    htmlDialogProto.close = function close() {
      this.open = false;
    };
  }

  let confirmCalls = 0;
  const originalConfirm = window.confirm;
  window.confirm = () => {
    confirmCalls += 1;
    return true;
  };

  try {
    render(
      React.createElement(NewItemSheet, {
        open: true,
        onClose: () => {},
        onSuccess: () => {},
        categories: [],
        locations: [],
        units: [],
      })
    );

    fireEvent.click(screen.getByLabelText('ปิด'));

    assert.equal(confirmCalls, 0);
  } finally {
    window.confirm = originalConfirm;
  }
});
