import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QrScannerModal } from '../../components/ui/qr-scanner-modal';

// Mock getUserMedia
const nav = global.navigator as unknown as { mediaDevices?: Record<string, unknown> };
if (!nav.mediaDevices) {
  nav.mediaDevices = {};
}
global.navigator.mediaDevices.getUserMedia = async () => {
  return {
    getTracks: () => [
      {
        stop: () => {},
      },
    ],
  } as unknown as MediaStream;
};

// Mock HTMLMediaElement.prototype.play
if (global.window.HTMLMediaElement && !global.window.HTMLMediaElement.prototype.play) {
  global.window.HTMLMediaElement.prototype.play = async () => {};
}

test('QrScannerModal renders null when isOpen is false', () => {
  const { container } = render(
    React.createElement(QrScannerModal, {
      isOpen: false,
      onClose: () => {},
      onScanSuccess: () => {},
    })
  );

  assert.equal(container.innerHTML, '');
});

test('QrScannerModal renders title and scanner frame when isOpen is true', async () => {
  render(
    React.createElement(QrScannerModal, {
      isOpen: true,
      onClose: () => {},
      onScanSuccess: () => {},
    })
  );

  assert.ok(screen.getByText('สแกน QR Code / บาร์โค้ด'));
  assert.ok(screen.getByPlaceholderText('กรอกรหัส หรือจำลองการสแกน...'));
});

test('QrScannerModal calls onClose when close button is clicked', () => {
  let closed = false;
  render(
    React.createElement(QrScannerModal, {
      isOpen: true,
      onClose: () => {
        closed = true;
      },
      onScanSuccess: () => {},
    })
  );

  const closeBtn = screen.getByRole('button', { name: 'ปิด' });
  fireEvent.click(closeBtn);

  assert.equal(closed, true);
});

test('QrScannerModal triggers onScanSuccess and onClose when preset code is clicked', () => {
  let scannedText = '';
  let closed = false;

  render(
    React.createElement(QrScannerModal, {
      isOpen: true,
      onClose: () => {
        closed = true;
      },
      onScanSuccess: (text) => {
        scannedText = text;
      },
    })
  );

  const presetBtn = screen.getByRole('button', { name: 'ITEM-001' });
  fireEvent.click(presetBtn);

  assert.equal(scannedText, 'ITEM-001');
  assert.equal(closed, true);
});

test('QrScannerModal triggers onScanSuccess and onClose when manual code is submitted', () => {
  let scannedText = '';
  let closed = false;

  render(
    React.createElement(QrScannerModal, {
      isOpen: true,
      onClose: () => {
        closed = true;
      },
      onScanSuccess: (text) => {
        scannedText = text;
      },
    })
  );

  const input = screen.getByPlaceholderText('กรอกรหัส หรือจำลองการสแกน...');
  fireEvent.change(input, { target: { value: 'BARCODE-999' } });

  const submitBtn = screen.getByRole('button', { name: /ส่งรหัส/i });
  fireEvent.click(submitBtn);

  assert.equal(scannedText, 'BARCODE-999');
  assert.equal(closed, true);
});

test('QrScannerModal shows error message when getUserMedia fails', async () => {
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = async () => {
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';
    throw error;
  };

  render(
    React.createElement(QrScannerModal, {
      isOpen: true,
      onClose: () => {},
      onScanSuccess: () => {},
    })
  );

  await waitFor(() => {
    assert.ok(
      screen.getByText('ถูกปฏิเสธการเข้าถึงกล้อง โปรดอนุญาตสิทธิ์ใช้งานกล้องในตั้งค่าเบราว์เซอร์')
    );
  });

  navigator.mediaDevices.getUserMedia = originalGetUserMedia;
});
