import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewItemSheet } from '../../features/items/components/new-item-sheet';

function mockDialogMethods() {
  const htmlDialogProto = window.HTMLDialogElement?.prototype as HTMLDialogElement | undefined;
  if (htmlDialogProto) {
    htmlDialogProto.showModal = function showModal() {
      this.open = true;
    };
    htmlDialogProto.close = function close() {
      this.open = false;
    };
  }
}

test('NewItemSheet does not warn about unsaved changes when untouched', () => {
  mockDialogMethods();

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

test('NewItemSheet uses a standard centered dialog without sheet animation CSS', () => {
  mockDialogMethods();

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

  const styleText = Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');

  assert.match(styleText, /align-items:\s*center/);
  assert.match(styleText, /justify-content:\s*center/);
  assert.doesNotMatch(styleText, /translateX/);
  assert.doesNotMatch(styleText, /transition:/);
  assert.doesNotMatch(styleText, /will-change/);
});

test('NewItemSheet restores a saved draft when opened', () => {
  mockDialogMethods();
  window.localStorage.setItem('registry-s:new-item-draft', JSON.stringify({ item_name: 'Draft Chair' }));

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

  const input = document.querySelector('input[name="item_name"]') as HTMLInputElement | null;
  assert.equal(input?.value, 'Draft Chair');
});

test('NewItemSheet saves draft field changes', () => {
  mockDialogMethods();
  window.localStorage.removeItem('registry-s:new-item-draft');

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

  const input = document.querySelector('input[name="item_name"]') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Draft Desk' } });

  const draft = JSON.parse(window.localStorage.getItem('registry-s:new-item-draft') ?? '{}') as { item_name?: string };
  assert.equal(draft.item_name, 'Draft Desk');
});
