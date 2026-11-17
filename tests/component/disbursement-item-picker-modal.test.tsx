import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DisbursementItemPickerModal } from '../../features/disbursements/components/disbursement-item-picker-modal';

const sampleItems = [
  {
    id: 'mat-1',
    item_name: 'ปากกาลูกลื่นสีน้ำเงิน',
    item_type: 'material' as const,
    asset_no: null,
    serial_no: null,
    quantity: 50,
    category: { id: 'cat-1', name: 'เครื่องเขียน' },
    unit: { name: 'ด้าม' },
    location_name: 'คลังพัสดุ A',
    responsible_person: null,
  },
  {
    id: 'mat-2',
    item_name: 'แฟ้มเอกสารสันกว้าง',
    item_type: 'material' as const,
    asset_no: null,
    serial_no: null,
    quantity: 0, // out of stock
    category: { id: 'cat-1', name: 'เครื่องเขียน' },
    unit: { name: 'แฟ้ม' },
    location_name: 'คลังพัสดุ A',
    responsible_person: null,
  },
  {
    id: 'asset-1',
    item_name: 'โปรเจคเตอร์ Epson',
    item_type: 'asset' as const,
    asset_no: '7110-002-0005/66',
    serial_no: 'EPSON-999',
    quantity: 1,
    category: { id: 'cat-2', name: 'โสตทัศนูปกรณ์' },
    unit: { name: 'เครื่อง' },
    location_name: 'ห้องประชุมใหญ่',
    responsible_person: null,
    note: 'อุปกรณ์ส่วนกลางประจำห้องประชุม',
  },
  {
    id: 'asset-non-central',
    item_name: 'คอมพิวเตอร์ประจำตัวเจ้าหน้าที่',
    item_type: 'asset' as const,
    asset_no: '7110-002-0006/66',
    serial_no: 'DELL-111',
    quantity: 1,
    category: { id: 'cat-2', name: 'โสตทัศนูปกรณ์' },
    unit: { name: 'เครื่อง' },
    location_name: 'ห้องทำงาน',
    responsible_person: 'นายทดสอบ ประจำการ',
    note: 'ประจำตัวบุคคล',
  },
];

test('DisbursementItemPickerModal renders nothing when open is false', () => {
  const { container } = render(
    React.createElement(DisbursementItemPickerModal, {
      open: false,
      onClose: () => {},
      onSelectItems: () => {},
      transactionType: 'material_issue',
      availableItems: sampleItems,
      alreadySelectedIds: [],
    })
  );

  assert.equal(container.innerHTML, '');
});

test('DisbursementItemPickerModal filters materials and respects out-of-stock toggle', () => {
  const { container } = render(
    React.createElement(DisbursementItemPickerModal, {
      open: true,
      onClose: () => {},
      onSelectItems: () => {},
      transactionType: 'material_issue',
      availableItems: sampleItems,
      alreadySelectedIds: [],
    })
  );

  assert.ok(container.textContent?.includes('เลือกพัสดุจากคลัง'));
  assert.ok(container.textContent?.includes('ปากกาลูกลื่นสีน้ำเงิน'));

  // Out-of-stock item is initially hidden because hideOutOfStock defaults to true for material_issue
  assert.equal(container.textContent?.includes('แฟ้มเอกสารสันกว้าง'), false);

  // Uncheck "ซ่อนรายการที่หมดสต็อก"
  const outOfStockCheckbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
  fireEvent.click(outOfStockCheckbox);

  // Now out-of-stock item should appear
  assert.ok(container.textContent?.includes('แฟ้มเอกสารสันกว้าง'));
});

test('DisbursementItemPickerModal filters by search query and category', () => {
  const { container } = render(
    React.createElement(DisbursementItemPickerModal, {
      open: true,
      onClose: () => {},
      onSelectItems: () => {},
      transactionType: 'asset_borrow',
      availableItems: sampleItems,
      alreadySelectedIds: [],
    })
  );

  assert.ok(container.textContent?.includes('โปรเจคเตอร์ Epson'));
  // Non-central item should NOT appear in asset_borrow
  assert.equal(container.textContent?.includes('คอมพิวเตอร์ประจำตัวเจ้าหน้าที่'), false);
  assert.ok(container.textContent?.includes('ส่วนกลาง'));

  // Search input
  const searchInput = screen.getByLabelText('ค้นหาพัสดุหรือครุภัณฑ์');
  fireEvent.change(searchInput, { target: { value: 'EPSON-999' } });
  assert.ok(container.textContent?.includes('โปรเจคเตอร์ Epson'));

  fireEvent.change(searchInput, { target: { value: 'NonExistingItem' } });
  assert.ok(container.textContent?.includes('ไม่พบพัสดุที่ตรงกับเงื่อนไขการค้นหา'));
});

test('DisbursementItemPickerModal handles item selection and confirmation', () => {
  let selectedResult: string[] = [];
  let closed = false;

  render(
    React.createElement(DisbursementItemPickerModal, {
      open: true,
      onClose: () => {
        closed = true;
      },
      onSelectItems: (ids: string[]) => {
        selectedResult = ids;
      },
      transactionType: 'asset_borrow',
      availableItems: sampleItems,
      alreadySelectedIds: [],
    })
  );

  const checkbox = screen.getByLabelText('เลือก โปรเจคเตอร์ Epson');
  fireEvent.click(checkbox);

  const confirmBtn = screen.getByRole('button', { name: /เพิ่มเข้ารายการยืม/ });
  fireEvent.click(confirmBtn);

  assert.deepEqual(selectedResult, ['asset-1']);
  assert.equal(closed, true);
});
