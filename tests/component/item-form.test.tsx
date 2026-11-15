import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ItemForm } from '../../features/items/components/item-form';

const noopAction = async () => ({ success: true });

test('standalone save and another clears the completed entry for the next item', async () => {
  const original = global.FormData;
  global.FormData = window.FormData;
  try {
    const view = render(React.createElement(ItemForm, {
      action: async () => ({ success: true, data: { intent: 'save_and_another' } }),
      categories: [], locations: [], units: [],
    }));
    fireEvent.change(screen.getByRole('textbox', { name: /ชื่อสิ่งของ/ }), { target: { value: 'โต๊ะที่บันทึกแล้ว' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'หมายเหตุ' }), { target: { value: 'หมายเหตุรายการเดิม' } });
    await act(async () => { fireEvent.submit(view.container.querySelector('form')!); });
    assert.equal((screen.getByRole('textbox', { name: /ชื่อสิ่งของ/ }) as HTMLInputElement).value, '');
    assert.equal((screen.getByRole('textbox', { name: 'หมายเหตุ' }) as HTMLTextAreaElement).value, '');
  } finally { global.FormData = original; }
});

test('failed saves retain entered values for correction and retry', async () => {
  const original = global.FormData;
  global.FormData = window.FormData;
  try {
    const view = render(React.createElement(ItemForm, {
      action: async () => ({ success: false, message: 'ตรวจสอบข้อมูล' }),
      categories: [], locations: [], units: [],
    }));
    const name = screen.getByRole('textbox', { name: /ชื่อสิ่งของ/ }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'โต๊ะทำงาน' } });
    await act(async () => { fireEvent.submit(view.container.querySelector('form')!); });
    assert.equal(name.value, 'โต๊ะทำงาน');
  } finally { global.FormData = original; }
});

test('save success is announced as a status rather than an error', async () => {
  const original = global.FormData;
  global.FormData = window.FormData;
  try {
    const view = render(React.createElement(ItemForm, {
      action: async () => ({ success: true, message: 'บันทึกแล้ว' }),
      categories: [], locations: [], units: [],
    }));
    await act(async () => { fireEvent.submit(view.container.querySelector('form')!); });
    assert.ok(screen.getByRole('status').textContent?.includes('บันทึกแล้ว'));
    assert.equal(screen.queryByRole('alert'), null);
  } finally { global.FormData = original; }
});

test('depreciation validation identifies the affected input and explains the error', async () => {
  const original = global.FormData;
  global.FormData = window.FormData;
  try {
    const view = render(React.createElement(ItemForm, {
      action: async () => ({ success: false, message: 'ตรวจสอบข้อมูล', fieldErrors: { depreciation_cost: ['มูลค่าต้องมากกว่า 1 บาท'] } }),
      categories: [], locations: [], units: [],
    }));
    fireEvent.click(screen.getByRole('checkbox', { name: /คิดค่าเสื่อมแบบเส้นตรง/ }));
    await act(async () => { fireEvent.submit(view.container.querySelector('form')!); });
    const input = screen.getByLabelText(/มูลค่าพร้อมใช้งาน/);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    const error = screen.getByText('มูลค่าต้องมากกว่า 1 บาท');
    assert.equal(input.getAttribute('aria-describedby'), error.id);
  } finally { global.FormData = original; }
});

test('canceling a replacement crop cannot submit the unconfirmed file', () => {
  const originalReader = global.FileReader;
  class Reader {
    result = 'data:image/jpeg;base64,mock';
    onload: (() => void) | null = null;
    readAsDataURL() { this.onload?.(); }
  }
  global.FileReader = Reader as unknown as typeof FileReader;
  try {
    const view = render(React.createElement(ItemForm, {
      action: noopAction, categories: [], locations: [], units: [],
      item: { id: 'item-1', item_name: 'Desk', item_type: 'asset', quantity: 1,
        unit_price: null, asset_no: null, serial_no: null, responsible_person: null,
        status: 'active', updated_at: '', created_at: '', category: null, unit: null,
        location: null, brand: null, model: null, note: null, image_url: '/existing.png' },
    }));
    const picker = view.container.querySelector('#image_file') as HTMLInputElement;
    fireEvent.change(picker, { target: { files: [new File(['new'], 'new.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(screen.getAllByRole('button', { name: 'ยกเลิก' }).at(-1)!);
    const submitted = view.container.querySelector('input[name="image_file"]') as HTMLInputElement;
    assert.equal(submitted.files?.length, 0);
    assert.equal(screen.getByAltText('Item preview').getAttribute('src'), '/existing.png');
  } finally { global.FileReader = originalReader; }
});

test('responsible person searches system users and submits the selected name', () => {
  Object.assign(globalThis, {
    Element: window.Element, Node: window.Node, DocumentFragment: window.DocumentFragment,
    getComputedStyle: window.getComputedStyle.bind(window), MutationObserver: window.MutationObserver,
    NodeFilter: window.NodeFilter, CustomEvent: window.CustomEvent,
  });
  const view = render(React.createElement(ItemForm, {
    action: noopAction, categories: [], locations: [], units: [],
    responsibleUsers: [{ id: 'u1', name: 'สมชาย ใจดี' }, { id: 'u2', name: 'สมหญิง รักงาน' }],
  }));
  const input = view.getByRole('combobox', { name: 'ผู้รับผิดชอบ' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'สมชาย' } });
  assert.equal(view.queryByRole('option', { name: 'สมหญิง รักงาน' }), null);
  fireEvent.click(view.getByRole('option', { name: 'สมชาย ใจดี' }));
  assert.equal(new window.FormData(view.container.querySelector('form')!).get('responsible_person'), 'สมชาย ใจดี');
  view.unmount();
});

test('ItemForm accepts a manual asset number without offering templates', () => {
  const { container } = render(React.createElement(ItemForm, {
    action: noopAction, categories: [], locations: [], units: [],
  }));
  const input = screen.getByRole('textbox', { name: 'เลขครุภัณฑ์' });
  fireEvent.change(input, { target: { value: 'สขส7.7110-006-0001-11/58' } });
  const submitted = new window.FormData(container.querySelector('form')!);
  assert.equal(submitted.get('asset_no'), 'สขส7.7110-006-0001-11/58');
  assert.equal(screen.queryByRole('checkbox', { name: 'ใช้แม่แบบเลขครุภัณฑ์' }) === null, true);
  assert.equal(submitted.has('asset_number_template_id'), false);
});

test('ItemForm preserves an existing asset number until the user edits it', () => {
  const { container } = render(React.createElement(ItemForm, {
    action: noopAction, categories: [], locations: [], units: [],
    item: {
      id: 'item-1', item_name: 'Desk', item_type: 'asset', quantity: 1,
      unit_price: null, asset_no: 'เดิม-001/69', serial_no: null,
      responsible_person: null, status: 'active', updated_at: '', created_at: '',
      category: null, unit: null, location: null, brand: null, model: null,
      note: null, image_url: null,
    },
  }));
  const form = container.querySelector('form')!;
  assert.equal(new window.FormData(form).get('asset_no'), 'เดิม-001/69');
  fireEvent.change(screen.getByRole('textbox', { name: 'เลขครุภัณฑ์' }), {
    target: { value: 'แก้ไข-002/69' },
  });
  assert.equal(new window.FormData(form).get('asset_no'), 'แก้ไข-002/69');
});

test('ItemForm shows image file validation as inline error', () => {
  let alertCalls = 0;
  const originalAlert = window.alert;
  window.alert = () => {
    alertCalls += 1;
  };

  try {
    const { container } = render(
      React.createElement(ItemForm, {
        action: noopAction,
        categories: [],
        locations: [],
        units: [],
      })
    );
    const fileInput = container.querySelector('#image_file') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['not-image'], 'item.txt', { type: 'text/plain' })],
      },
    });

    assert.equal(alertCalls, 0);
    assert.ok(screen.getByText('กรุณาเลือกไฟล์รูปภาพประเภท JPEG, PNG หรือ WEBP เท่านั้น'));
  } finally {
    window.alert = originalAlert;
  }
});

test('ItemForm revokes old local image previews when replacing files', async () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalFileReader = global.FileReader;
  const revoked: string[] = [];
  let counter = 0;

  class MockFileReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    readAsDataURL() {
      this.result = 'data:image/jpeg;base64,mock';
      if (this.onload) {
        this.onload();
      }
    }
  }
  global.FileReader = MockFileReader as unknown as typeof FileReader;

  URL.createObjectURL = () => {
    counter += 1;
    return `blob:test-${counter}`;
  };
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };

  try {
    const { container } = render(
      React.createElement(ItemForm, {
        action: noopAction,
        categories: [],
        locations: [],
        units: [],
      })
    );
    const fileInput = container.querySelector('#image_file') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['first'], 'first.jpg', { type: 'image/jpeg' })],
      },
    });

    const confirmBtn1 = screen.getByText('ครอบรูปภาพ (4:3)');
    fireEvent.click(confirmBtn1);

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })],
      },
    });

    const confirmBtn2 = screen.getByText('ครอบรูปภาพ (4:3)');
    fireEvent.click(confirmBtn2);

    assert.deepEqual(revoked, ['blob:test-1']);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    global.FileReader = originalFileReader;
  }
});
