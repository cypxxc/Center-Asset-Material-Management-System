import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from '@testing-library/react';
import {
  DisbursementStatusBadge,
  DisbursementTypeBadge,
} from '../../features/disbursements/components/badges';
import { DisbursementListClient } from '../../features/disbursements/components/disbursement-list-client';

test('DisbursementStatusBadge renders text label and svg icon (Hard Rule compliance)', () => {
  const { container } = render(React.createElement(DisbursementStatusBadge, { status: 'confirmed' }));
  assert.ok(container.textContent?.includes('ยืนยันแล้ว'));
  const svg = container.querySelector('svg');
  assert.ok(svg, 'Badge must render an icon alongside text to comply with accessibility rule');
});

test('DisbursementTypeBadge renders text label and svg icon', () => {
  const { container } = render(React.createElement(DisbursementTypeBadge, { type: 'material_issue' }));
  assert.ok(container.textContent?.includes('เบิกจ่ายพัสดุ'));
  const svg = container.querySelector('svg');
  assert.ok(svg, 'Type badge must render an icon alongside text');
});

test('DisbursementListClient renders EmptyState when items array is empty', () => {
  const { container } = render(
    React.createElement(DisbursementListClient, {
      initialItems: [],
      total: 0,
      currentPage: 1,
      pageSize: 50,
      totalPages: 1,
      currentQ: '',
      currentStatus: '',
      currentType: '',
      canCreate: true,
    })
  );

  assert.ok(container.textContent?.includes('ทะเบียนเบิก-จ่ายพัสดุและครุภัณฑ์'));
  assert.ok(container.textContent?.includes('ยังไม่มีประวัติการเบิก-จ่าย'));
  assert.ok(container.textContent?.includes('สร้างเอกสารเบิกจ่าย'));
});

test('DisbursementListClient renders DataTable and rows when items exist', () => {
  const mockItem = {
    id: 'doc-1',
    document_no: 'DISB-2026-0001',
    fiscal_year: 2569,
    transaction_type: 'asset_borrow' as const,
    recipient_name: 'สมชาย ใจดี',
    department_name: 'งานเทคโนโลยีสารสนเทศ',
    purpose: 'ยืมใช้งานประชุมประจำปี',
    status: 'active_borrow' as const,
    created_at: new Date().toISOString(),
    created_by: 'user-1',
    updated_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    confirmed_by: 'user-1',
    cancelled_at: null,
    reversed_at: null,
    reversed_by: null,
    reversal_reason: null,
    due_date: '2026-11-01',
    snapshot: {},
    notes: null,
  };

  const { container } = render(
    React.createElement(DisbursementListClient, {
      initialItems: [mockItem],
      total: 1,
      currentPage: 1,
      pageSize: 50,
      totalPages: 1,
      currentQ: '',
      currentStatus: '',
      currentType: '',
      canCreate: false,
    })
  );

  assert.ok(container.textContent?.includes('DISB-2026-0001'));
  assert.ok(container.textContent?.includes('สมชาย ใจดี'));
  assert.ok(container.textContent?.includes('งานเทคโนโลยีสารสนเทศ'));
  assert.ok(container.textContent?.includes('กำลังยืม'));
  assert.ok(container.querySelector('table'));
});
