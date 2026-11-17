import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

let pushedUrl = '';
const nextNavigationPath = require.resolve('next/navigation');
const nextNavigation = require.cache[nextNavigationPath]?.exports as {
  useRouter: () => { push: (url: string) => void; refresh: () => void };
};
nextNavigation.useRouter = () => ({
  push: (url: string) => {
    pushedUrl = url;
  },
  refresh: () => {},
});

// Mock Server Actions via require.cache
const actionsPath = require.resolve('../../features/disbursements/actions');
let createDraftPayload: unknown = null;
let updateDraftPayload: unknown = null;

require.cache[actionsPath] = {
  id: actionsPath,
  filename: actionsPath,
  loaded: true,
  exports: {
    createDisbursementDraft: async (input: unknown) => {
      createDraftPayload = input;
      return { ok: true, data: { id: 'new-draft-123' } };
    },
    updateDisbursementDraft: async (input: unknown) => {
      updateDraftPayload = input;
      return { ok: true, data: { id: 'updated-draft-456' } };
    },
  },
} as unknown as NodeJS.Module;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DisbursementDraftFormClient } = require(
  '../../features/disbursements/components/disbursement-draft-form-client'
);

const sampleAvailableItems = [
  {
    id: 'mat-1',
    item_name: 'กระดาษ A4 80 แกรม',
    item_type: 'material' as const,
    asset_no: null,
    serial_no: null,
    quantity: 10,
    category: { id: 'cat-1', name: 'วัสดุสำนักงาน' },
    unit: { name: 'รีม' },
    location_name: 'ห้องพัสดุ 1',
    responsible_person: null,
  },
  {
    id: 'asset-1',
    item_name: 'โน้ตบุ๊ก Dell Latitude',
    item_type: 'asset' as const,
    asset_no: '7110-001-0001/67',
    serial_no: 'SN-DELL-9988',
    quantity: 1,
    category: { id: 'cat-2', name: 'คอมพิวเตอร์' },
    unit: { name: 'เครื่อง' },
    location_name: 'ห้อง IT',
    responsible_person: null,
    note: 'ของส่วนกลาง',
  },
];

test('DisbursementDraftFormClient renders empty state initially and opens item picker', () => {
  pushedUrl = '';
  const { container } = render(
    React.createElement(DisbursementDraftFormClient, {
      availableItems: sampleAvailableItems,
      initialItemIds: [],
    })
  );

  assert.ok(container.textContent?.includes('สร้างเอกสารเบิก-จ่ายใหม่'));
  assert.ok(container.textContent?.includes('ยังไม่มีรายการวัสดุในเอกสารนี้'));
  assert.ok(container.querySelector('#disbursement-transaction-type'));
  assert.ok(container.querySelector('#disbursement-recipient-name'));
  assert.ok(container.querySelector('#disbursement-department-name'));
  assert.ok(container.querySelector('#disbursement-purpose'));
});

test('DisbursementDraftFormClient validates required inputs before submitting', async () => {
  const { container } = render(
    React.createElement(DisbursementDraftFormClient, {
      availableItems: sampleAvailableItems,
      initialItemIds: [],
    })
  );

  const form = container.querySelector('form')!;
  fireEvent.submit(form);

  assert.ok(container.textContent?.includes('กรุณาระบุชื่อผู้รับวัสดุ / ผู้ยืม'));
});

test('DisbursementDraftFormClient enforces due date when transaction type is asset_borrow', async () => {
  const { container } = render(
    React.createElement(DisbursementDraftFormClient, {
      availableItems: sampleAvailableItems,
      initialItemIds: ['asset-1'],
      initialType: 'asset_borrow',
    })
  );

  fireEvent.change(container.querySelector('#disbursement-recipient-name')!, {
    target: { value: 'นายกิตติ บุญชู' },
  });
  fireEvent.change(container.querySelector('#disbursement-department-name')!, {
    target: { value: 'งานธุรการ' },
  });
  fireEvent.change(container.querySelector('#disbursement-purpose')!, {
    target: { value: 'นำไปใช้งานประชุมนอกสถานที่' },
  });

  const form = container.querySelector('form')!;
  fireEvent.submit(form);

  assert.ok(container.textContent?.includes('กรุณาระบุกำหนดส่งคืนสำหรับการยืมครุภัณฑ์'));
});

test('DisbursementDraftFormClient handles quantity stepper and stock limit', async () => {
  const { container } = render(
    React.createElement(DisbursementDraftFormClient, {
      availableItems: sampleAvailableItems,
      initialItemIds: ['mat-1'],
      initialType: 'material_issue',
    })
  );

  assert.ok(container.textContent?.includes('กระดาษ A4 80 แกรม'));
  const qtyInput = container.querySelector('input[type="number"]') as HTMLInputElement;
  assert.equal(qtyInput.value, '1');

  // Click Plus button
  const plusBtn = screen.getByTitle('เพิ่มจำนวน');
  fireEvent.click(plusBtn);
  assert.equal(qtyInput.value, '2');

  // Click Minus button
  const minusBtn = screen.getByTitle('ลดจำนวน');
  fireEvent.click(minusBtn);
  assert.equal(qtyInput.value, '1');

  // Minus disabled at 1
  assert.equal(minusBtn.hasAttribute('disabled'), true);
});

test('DisbursementDraftFormClient successfully creates a new draft', async () => {
  pushedUrl = '';
  createDraftPayload = null;

  const { container } = render(
    React.createElement(DisbursementDraftFormClient, {
      availableItems: sampleAvailableItems,
      initialItemIds: ['mat-1'],
      initialType: 'material_issue',
    })
  );

  fireEvent.change(container.querySelector('#disbursement-recipient-name')!, {
    target: { value: 'นางสาววิภาวดี มาดี' },
  });
  fireEvent.change(container.querySelector('#disbursement-department-name')!, {
    target: { value: 'ฝ่ายการเงิน' },
  });
  fireEvent.change(container.querySelector('#disbursement-purpose')!, {
    target: { value: 'ใช้พิมพ์เอกสารงบประมาณ' },
  });

  const submitButton = screen.getByRole('button', { name: /บันทึกฉบับร่าง/ });
  fireEvent.click(submitButton);

  await waitFor(() => {
    assert.equal(pushedUrl, '/disbursements/new-draft-123');
  });

  assert.deepEqual(createDraftPayload, {
    transaction_type: 'material_issue',
    recipient_name: 'นางสาววิภาวดี มาดี',
    department_name: 'ฝ่ายการเงิน',
    purpose: 'ใช้พิมพ์เอกสารงบประมาณ',
    due_date: null,
    items: [{ item_id: 'mat-1', requested_qty: 1 }],
  });
});

test('DisbursementDraftFormClient updates an existing draft', async () => {
  pushedUrl = '';
  updateDraftPayload = null;

  const initialDoc = {
    id: 'draft-doc-999',
    document_no: null,
    fiscal_year: 2569,
    transaction_type: 'material_issue' as const,
    recipient_name: 'เดิม',
    department_name: 'แผนกเดิม',
    purpose: 'วัตถุประสงค์เดิม',
    status: 'draft' as const,
    created_at: new Date().toISOString(),
    created_by: 'user-1',
    updated_at: new Date().toISOString(),
    confirmed_at: null,
    confirmed_by: null,
    cancelled_at: null,
    reversed_at: null,
    reversed_by: null,
    reversal_reason: null,
    due_date: null,
    snapshot: {},
    notes: null,
    items: [
      {
        id: 'line-1',
        disbursement_id: 'draft-doc-999',
        item_id: 'mat-1',
        requested_qty: 2,
        issued_qty: 0,
        returned_qty: 0,
        item_name_snapshot: 'กระดาษ A4 80 แกรม',
        asset_no_snapshot: null,
        serial_no_snapshot: null,
        unit_price_snapshot: 120,
        unit_name_snapshot: 'รีม',
        category_name_snapshot: 'วัสดุสำนักงาน',
        status: 'draft' as const,
      },
    ],
  };

  const { container } = render(
    React.createElement(DisbursementDraftFormClient, {
      availableItems: sampleAvailableItems,
      initialDoc,
    })
  );

  fireEvent.change(container.querySelector('#disbursement-recipient-name')!, {
    target: { value: 'ชื่อใหม่' },
  });

  const submitButton = screen.getByRole('button', { name: /บันทึกฉบับร่าง/ });
  fireEvent.click(submitButton);

  await waitFor(() => {
    assert.equal(pushedUrl, '/disbursements/draft-doc-999');
  });

  assert.deepEqual(updateDraftPayload, {
    id: 'draft-doc-999',
    transaction_type: 'material_issue',
    recipient_name: 'ชื่อใหม่',
    department_name: 'แผนกเดิม',
    purpose: 'วัตถุประสงค์เดิม',
    due_date: null,
    items: [{ item_id: 'mat-1', requested_qty: 2 }],
  });
});
