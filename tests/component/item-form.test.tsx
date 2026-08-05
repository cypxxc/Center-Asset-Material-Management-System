import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ItemForm } from '../../features/items/components/item-form';

const noopAction = async () => ({ success: true });

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
  global.FileReader = MockFileReader as any;

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
