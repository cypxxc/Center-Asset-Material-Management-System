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

test('NewItemSheet shows all entry sections together and submits from its footer', () => {
  mockDialogMethods();
  window.localStorage.removeItem('omni-asset:new-item-draft');
  const view = render(React.createElement(NewItemSheet, {
    open: true, onClose: () => {}, onSuccess: () => {},
    categories: [], locations: [{ id: 'location-1', name: 'สำนักงาน' }],
    units: [{ id: 'unit-1', name: 'ชิ้น' }],
  }));
  const dialog = within(view.container).getByRole('dialog', { name: 'เพิ่มรายการสิ่งของใหม่' });
  for (const label of ['ชื่อสิ่งของ', 'Serial Number', 'สถานที่', 'ผู้รับผิดชอบ', 'หมายเหตุ']) {
    const control = within(dialog).getByLabelText(new RegExp(`^${label}(?:\\s*\\*)?$`));
    assert.equal(control.closest('[hidden]'), null);
  }
  assert.equal(within(dialog).queryByRole('button', { name: 'ถัดไป' }), null);
  assert.equal(within(dialog).queryByRole('button', { name: 'ย้อนกลับ' }), null);
  for (const name of ['ข้อมูลหลัก', 'รายละเอียดสิ่งของ', 'สถานที่และผู้รับผิดชอบ', 'รูปภาพและหมายเหตุ']) {
    assert.ok(within(dialog).getByRole('heading', { name }));
  }
  const submit = within(dialog).getByRole('button', { name: 'บันทึกรายการ' }) as HTMLButtonElement;
  assert.equal(submit.form, view.container.querySelector('form'));
  assert.equal(submit.form?.checkValidity(), false);
  fireEvent.change(within(dialog).getByLabelText(/^ชื่อสิ่งของ/), { target: { value: 'Desk' } });
  fireEvent.change(within(dialog).getByLabelText(/^หน่วยนับ/), { target: { value: 'unit-1' } });
  assert.equal(submit.form?.checkValidity(), true);
});

test('ItemForm switches item type on the same page without hiding common fields', () => {
  const view = render(React.createElement(ItemForm, {
    action: noopAction, categories: [], locations: [], units: [],
  }));
  fireEvent.change(within(view.container).getByLabelText(/^ชื่อสิ่งของ/), { target: { value: 'Paper' } });
  fireEvent.click(within(view.container).getByRole('tab', { name: 'วัสดุ' }));
  assert.equal((within(view.container).getByLabelText(/^ชื่อสิ่งของ/) as HTMLInputElement).value, 'Paper');
  assert.equal((view.container.querySelector('[name="item_type"]') as HTMLInputElement).value, 'material');
  assert.ok(within(view.container).getByLabelText('สถานที่'));
  assert.equal(within(view.container).queryByLabelText('Serial Number'), null);
});
