import '../setup/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mockSupabaseRegistry } from '../mocks/supabase';
import { importItemsBulk } from '../../features/items/actions';

test('importItemsBulk rejects unauthorized users', async () => {
  mockSupabaseRegistry.clear();
  
  const res = await importItemsBulk('item_name,quantity\nChair,1');
  assert.equal(res.success, false);
  assert.equal(res.error, 'กรุณาเข้าสู่ระบบก่อนทำรายการ');
});

test('importItemsBulk rejects missing item_name header', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const res = await importItemsBulk('quantity,status\n1,active');
  assert.equal(res.success, false);
  assert.equal(res.error, 'ไม่พบหัวคอลัมน์ "item_name" (ชื่อสิ่งของ) กรุณาตรวจสอบไฟล์ของคุณว่ามีหัวตารางที่ถูกต้อง');
});

test('importItemsBulk rejects rows with mismatched columns count', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const res = await importItemsBulk('item_name,quantity,status\nChair,1\nDesk,1,active');
  assert.equal(res.success, false);
  assert.equal(res.error, 'บรรทัดที่ 2: จำนวนคอลัมน์ไม่ครบถ้วน (พบ 2 คอลัมน์, ต้องการอย่างน้อย 3 คอลัมน์)');
});

test('importItemsBulk rejects general item type', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const res = await importItemsBulk('item_name,item_type,quantity\nCable,general,1');
  assert.equal(res.success, false);
  assert.equal(res.error, 'บรรทัดที่ 2: ประเภทสิ่งของ (item_type) ต้องเป็น asset หรือ material');
});

test('importItemsBulk rejects non-numeric unit price', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const res = await importItemsBulk('item_name,item_type,quantity,unit_price\nCable,asset,1,abc');
  assert.equal(res.success, false);
  assert.match(res.error ?? '', /unit_price/);
});

test('importItemsBulk rejects negative unit price', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  const res = await importItemsBulk('item_name,item_type,quantity,unit_price\nCable,asset,1,-1');
  assert.equal(res.success, false);
  assert.match(res.error ?? '', /unit_price/);
});

test('importItemsBulk returns readable custom RPC error message', async () => {
  mockSupabaseRegistry.clear();
  mockSupabaseRegistry.setAuth(
    { id: 'user-staff', email: 'staff@example.com' },
    { id: 'user-staff', email: 'staff@example.com', role: 'staff', is_active: true }
  );

  // Set mock RPC response to return failure
  mockSupabaseRegistry.setRpcResponse('import_items_bulk_tx', {
    ok: false,
    error: 'แถวที่ 3: เลขครุภัณฑ์ "AS-001" ซ้ำกับที่มีอยู่ในระบบ'
  });

  const res = await importItemsBulk('item_name,quantity,asset_no\nChair,1,AS-001\nDesk,1,AS-001');
  assert.equal(res.success, false);
  assert.equal(res.error, 'เกิดข้อผิดพลาดขณะนำเข้าข้อมูล: แถวที่ 3: เลขครุภัณฑ์ "AS-001" ซ้ำกับที่มีอยู่ในระบบ');
});
