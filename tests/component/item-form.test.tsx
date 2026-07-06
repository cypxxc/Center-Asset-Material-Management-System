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

test('ItemForm revokes old local image previews when replacing files', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const revoked: string[] = [];
  let counter = 0;

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
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })],
      },
    });

    assert.deepEqual(revoked, ['blob:test-1']);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
