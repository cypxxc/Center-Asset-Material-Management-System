import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const originalImage = global.Image;
  const CanvasProto = (window as unknown as { HTMLCanvasElement: { prototype: HTMLCanvasElement } }).HTMLCanvasElement.prototype;
  const originalGetContext = CanvasProto.getContext;
  const originalToBlob = CanvasProto.toBlob;
  const revoked: string[] = [];
  let counter = 0;

  class MockFileReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    readAsDataURL(file?: Blob | unknown) {
      this.result = `data:image/jpeg;base64,mock-${(file as { name?: string })?.name || Math.random()}`;
      setTimeout(() => {
        if (this.onload) {
          this.onload();
        }
      }, 0);
    }
  }
  global.FileReader = MockFileReader as unknown as typeof FileReader;
  window.FileReader = MockFileReader as unknown as typeof FileReader;

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin = '';
    naturalWidth = 800;
    naturalHeight = 600;
    private _src = '';
    set src(val: string) {
      this._src = val;
      setTimeout(() => this.onload?.(), 0);
    }
    get src() {
      return this._src;
    }
  }
  global.Image = MockImage as unknown as typeof Image;
  window.Image = MockImage as unknown as typeof Image;

  CanvasProto.getContext = (() => ({
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillStyle: '',
    fillRect: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    drawImage: () => {},
  })) as unknown as typeof CanvasProto.getContext;

  CanvasProto.toBlob = function(callback: BlobCallback, type = 'image/jpeg') {
    const blob = new Blob(['mock-data'], { type });
    setTimeout(() => callback(blob), 0);
  };

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

    const confirmBtn1 = await screen.findByText('ครอบรูปภาพ (4:3)');
    fireEvent.click(confirmBtn1);

    await waitFor(() => {
      assert.equal(screen.queryByText('ครอบรูปภาพ (4:3)'), null);
    });

    fireEvent.change(fileInput, {
      target: {
        files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })],
      },
    });

    const confirmBtn2 = await screen.findByText('ครอบรูปภาพ (4:3)');
    fireEvent.click(confirmBtn2);

    await waitFor(() => {
      assert.deepEqual(revoked, ['blob:test-1']);
    });
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    global.FileReader = originalFileReader;
    global.Image = originalImage;
    CanvasProto.getContext = originalGetContext;
    CanvasProto.toBlob = originalToBlob;
  }
});
