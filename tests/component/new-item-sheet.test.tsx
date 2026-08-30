import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ItemForm } from '../../features/items/components/item-form';
import { NewItemSheet } from '../../features/items/components/new-item-sheet';

const noopAction = async () => ({ success: true });

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
  window.localStorage.setItem('omni-asset:new-item-draft', JSON.stringify({ item_name: 'Draft Chair' }));

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
  window.localStorage.removeItem('omni-asset:new-item-draft');

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

  const draft = JSON.parse(window.localStorage.getItem('omni-asset:new-item-draft') ?? '{}') as { item_name?: string };
  assert.equal(draft.item_name, 'Draft Desk');
});

test('ItemForm renders the fields for the requested wizard step', () => {
  const stepOne = render(
    React.createElement(ItemForm, {
      action: noopAction,
      categories: [],
      locations: [],
      units: [],
      wizardStep: 1,
    })
  );

  assert.ok(stepOne.container.querySelector('input[name="item_name"]'));
  assert.ok(stepOne.container.querySelector('input[name="quantity"]'));
  assert.ok(stepOne.container.querySelector('select[name="unit_id"]'));
  assert.ok(stepOne.container.querySelector('select[name="location_id"]'));
  assert.equal(stepOne.container.querySelector('input[name="serial_no"]')?.closest('[hidden]') !== null, true);
  stepOne.unmount();

  const stepTwo = render(
    React.createElement(ItemForm, {
      action: noopAction,
      categories: [],
      locations: [],
      units: [],
      wizardStep: 2,
    })
  );

  assert.ok(stepTwo.container.querySelector('input[name="serial_no"]'));
  assert.ok(stepTwo.container.querySelector('input[name="image_file"]'));
  assert.ok(stepTwo.container.querySelector('textarea[name="note"]'));
  assert.ok(stepTwo.container.querySelector('button[type="submit"]'));
});

test('NewItemSheet advances only after valid Step 1 fields and keeps values when returning', () => {
  mockDialogMethods();

  const view = render(
    React.createElement(NewItemSheet, {
      open: true,
      onClose: () => {},
      onSuccess: () => {},
      categories: [],
      locations: [],
      units: [{ id: 'unit-1', name: 'ชิ้น' }],
    })
  );

  const itemName = document.querySelector('input[name="item_name"]') as HTMLInputElement;
  fireEvent.change(itemName, { target: { value: 'Desk' } });
  fireEvent.change(document.querySelector('select[name="unit_id"]') as HTMLSelectElement, { target: { value: 'unit-1' } });
  fireEvent.click(within(view.container).getByRole('button', { name: 'ถัดไป' }));

  assert.equal(view.container.querySelector('[aria-live="polite"]')?.textContent, '2 จาก 2');
  fireEvent.click(within(view.container).getByRole('button', { name: 'ย้อนกลับ' }));
  assert.equal((view.container.querySelector('input[name="item_name"]') as HTMLInputElement).value, 'Desk');
});

test('NewItemSheet keeps focus on an invalid Step 1 field', () => {
  mockDialogMethods();
  window.localStorage.removeItem('omni-asset:new-item-draft');

  const view = render(
    React.createElement(NewItemSheet, {
      open: true,
      onClose: () => {},
      onSuccess: () => {},
      categories: [],
      locations: [],
      units: [{ id: 'unit-1', name: 'ชิ้น' }],
    })
  );

  fireEvent.click(within(view.container).getByRole('button', { name: 'ถัดไป' }));

  assert.equal(view.container.querySelector('[aria-live="polite"]')?.textContent, '1 จาก 2');
  assert.equal(document.activeElement, view.container.querySelector('input[name="item_name"]'));
});
