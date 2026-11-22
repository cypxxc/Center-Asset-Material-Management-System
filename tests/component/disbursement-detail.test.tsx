import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const nextNavigationPath = require.resolve('next/navigation');
let refreshed = false;
const nextNavigation = require.cache[nextNavigationPath]?.exports as {
  useRouter: () => { push: (url: string) => void; refresh: () => void };
};
nextNavigation.useRouter = () => ({
  push: () => {},
  refresh: () => {
    refreshed = true;
  },
});

// Mock Server Actions via require.cache
const actionsPath = require.resolve('../../features/disbursements/actions');
let confirmCallId = '';
let cancelCallId = '';
let returnCallPayload: unknown = null;
let reverseCallPayload: unknown = null;

require.cache[actionsPath] = {
  id: actionsPath,
  filename: actionsPath,
  loaded: true,
  exports: {
    confirmDisbursement: async (id: string) => {
      confirmCallId = id;
      return { ok: true, data: { document_no: 'DISB-2026-0099' } };
    },
    cancelDisbursementDraft: async (payload: { id: string }) => {
      cancelCallId = payload.id;
      return { ok: true, data: { ok: true } };
    },
    returnDisbursementItem: async (input: unknown) => {
      returnCallPayload = input;
      return { ok: true, data: { ok: true } };
    },
    loadOriginLocationAction: async () => {
      return { ok: true, data: { id: 'loc-1', name: 'ห้องทำงานชั้น 3' } };
    },
    partialReturnDisbursement: async (input: unknown) => {
      returnCallPayload = input;
      return { ok: true, data: { ok: true } };
    },
    reverseDisbursement: async (input: unknown) => {
      reverseCallPayload = input;
      return { ok: true, data: { ok: true } };
    },
  },
} as unknown as NodeJS.Module;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DisbursementDetailClient } = require(
  '../../features/disbursements/components/disbursement-detail-client'
);

const sampleBorrowDoc = {
  id: 'doc-borrow-1',
  document_no: 'DISB-2026-0005',
  fiscal_year: 2569,
  transaction_type: 'asset_borrow' as const,
  recipient_name: 'นายสมศักดิ์ ขยันงาน',
  department_name: 'กลุ่มงานระบาดวิทยา',
  purpose: 'ออกสำรวจภาคสนามควบคุมโรค',
  status: 'active_borrow' as const,
  created_at: new Date('2026-10-15T08:00:00Z').toISOString(),
  created_by: 'staff-user-1',
  updated_at: new Date('2026-10-15T08:30:00Z').toISOString(),
  confirmed_at: new Date('2026-10-15T08:30:00Z').toISOString(),
  confirmed_by: 'staff-user-1',
  cancelled_at: null,
  reversed_at: null,
  reversed_by: null,
  reversal_reason: null,
  due_date: '2026-10-30',
  snapshot: {},
  notes: null,
  items: [
    {
      id: 'line-borrow-1',
      disbursement_id: 'doc-borrow-1',
      item_id: 'asset-dev-1',
      requested_qty: 1,
      issued_qty: 1,
      returned_qty: 0,
      item_name_snapshot: 'กล้องส่องตรวจโรค Olympus',
      asset_no_snapshot: '7110-003-0012/66',
      serial_no_snapshot: 'OLY-994411',
      unit_price_snapshot: 45000,
      unit_name_snapshot: 'ชุด',
      category_name_snapshot: 'เครื่องมือแพทย์',
      status: 'active_borrow' as const,
    },
  ],
};

const sampleDraftDoc = {
  ...sampleBorrowDoc,
  id: 'doc-draft-1',
  document_no: null,
  status: 'draft' as const,
  confirmed_at: null,
  confirmed_by: null,
  due_date: '2099-12-31',
};

test('DisbursementDetailClient confirms draft and cancels draft when triggered', async () => {
  refreshed = false;
  confirmCallId = '';
  cancelCallId = '';

  const { container } = render(
    React.createElement(DisbursementDetailClient, {
      doc: sampleDraftDoc,
      canMutate: true,
    })
  );

  const confirmBtn = screen.getByRole('button', { name: /จ่ายและยืนยัน|ยืนยันการเบิก-จ่าย/ });
  fireEvent.click(confirmBtn);

  await waitFor(() => {
    assert.equal(confirmCallId, 'doc-draft-1');
    assert.ok(container.textContent?.includes('DISB-2026-0099'));
  });

  // Cancel draft flow
  const cancelBtn = screen.getByRole('button', { name: /ยกเลิกร่าง/ });
  fireEvent.click(cancelBtn);

  const cancelModalAction = screen.getByRole('button', { name: 'ยืนยันยกเลิกร่าง' });
  fireEvent.click(cancelModalAction);

  await waitFor(() => {
    assert.equal(cancelCallId, 'doc-draft-1');
  });
});

test('DisbursementDetailClient renders metadata, badges, and items correctly', () => {
  const { container } = render(
    React.createElement(DisbursementDetailClient, {
      doc: sampleBorrowDoc,
      canMutate: true,
    })
  );

  assert.ok(container.textContent?.includes('DISB-2026-0005'));
  assert.ok(container.textContent?.includes('นายสมศักดิ์ ขยันงาน'));
  assert.ok(container.textContent?.includes('กลุ่มงานระบาดวิทยา'));
  assert.ok(container.textContent?.includes('ออกสำรวจภาคสนามควบคุมโรค'));
  assert.ok(container.textContent?.includes('ปีงบประมาณ พ.ศ. 2569'));
  assert.ok(container.textContent?.includes('กล้องส่องตรวจโรค Olympus'));
  assert.ok(container.textContent?.includes('7110-003-0012/66'));
  assert.ok(container.textContent?.includes('พิมพ์ใบเบิก-จ่าย (A4)'));
});

test('DisbursementDetailClient enforces RBAC: viewer cannot see action buttons', () => {
  const { container } = render(
    React.createElement(DisbursementDetailClient, {
      doc: sampleDraftDoc,
      canMutate: false, // Viewer role
    })
  );

  assert.equal(container.textContent?.includes('แก้ไขร่าง'), false);
  assert.equal(container.textContent?.includes('ยกเลิกร่าง'), false);
  assert.equal(container.textContent?.includes('ยืนยันการเบิก-จ่าย'), false);
});

test('DisbursementDetailClient opens return modal and submits item return', async () => {
  refreshed = false;
  returnCallPayload = null;

  render(
    React.createElement(DisbursementDetailClient, {
      doc: sampleBorrowDoc,
      canMutate: true,
    })
  );

  const returnBtn = screen.getByRole('button', { name: /^คืน \(/ });
  fireEvent.click(returnBtn);

  await waitFor(() => {
    assert.equal(refreshed, true);
  });

  assert.ok(returnCallPayload);
  const payload = returnCallPayload as { disbursement_id?: string; items?: { line_id: string; condition: string }[]; line_id?: string };
  if (payload.items) {
    assert.equal(payload.disbursement_id, 'doc-borrow-1');
    assert.equal(payload.items[0].line_id, 'line-borrow-1');
    assert.equal(payload.items[0].condition, 'normal');
  } else {
    assert.equal(payload.line_id, 'line-borrow-1');
  }
  assert.equal(refreshed, true);
});

test('DisbursementDetailClient opens reversal modal and validates reason before reversal', async () => {
  refreshed = false;
  reverseCallPayload = null;

  const { container } = render(
    React.createElement(DisbursementDetailClient, {
      doc: sampleBorrowDoc,
      canMutate: true,
    })
  );

  const reverseBtn = screen.getByRole('button', { name: /คืนสภาพเอกสาร/ });
  fireEvent.click(reverseBtn);

  const dialog = screen.getByRole('dialog', { name: /คืนสภาพเอกสาร/ });
  assert.ok(dialog);

  // Reason textarea
  const reasonTextarea = container.querySelector('#reverse-reason-textarea') as HTMLTextAreaElement;
  fireEvent.change(reasonTextarea, { target: { value: 'พิมพ์เอกสารผิดพลาด ต้องการออกฉบับใหม่' } });

  const confirmReverseBtn = screen.getByRole('button', { name: 'ยืนยันคืนสภาพ' });
  fireEvent.click(confirmReverseBtn);

  await waitFor(() => {
    assert.ok(container.textContent?.includes('คืนสภาพเอกสารและปรับปรุงยอดเรียบร้อยแล้ว'));
  });

  assert.deepEqual(reverseCallPayload, {
    disbursement_id: 'doc-borrow-1',
    reason: 'พิมพ์เอกสารผิดพลาด ต้องการออกฉบับใหม่',
  });
  assert.equal(refreshed, true);
});
