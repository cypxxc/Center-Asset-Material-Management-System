import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ItemForm } from '../../features/items/components/item-form';

const noopAction = async () => ({ success: true });

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
