import test from 'node:test';
import assert from 'node:assert/strict';
import { cn, getItemValue } from '../../lib/utils';

test('cn merges tailwind classes correctly', () => {
  const result = cn('px-2 py-1', 'bg-blue-500', { 'hover:bg-blue-600': true, 'hidden': false });
  assert.equal(result.includes('px-2'), true);
  assert.equal(result.includes('py-1'), true);
  assert.equal(result.includes('bg-blue-500'), true);
  assert.equal(result.includes('hover:bg-blue-600'), true);
  assert.equal(result.includes('hidden'), false);
});

test('getItemValue estimates asset/material valuation based on name and category', () => {
  // Test by name keyword matching
  assert.equal(getItemValue('Dell Latitude Laptop'), 35000);
  assert.equal(getItemValue('Ergonomic Office Chair'), 5500);
  assert.equal(getItemValue('Epson Projector EB-X06'), 18900);
  assert.equal(getItemValue('HP LaserJet Printer'), 8900);
  assert.equal(getItemValue('Apple iPad Air'), 16900);

  // Test by category matching
  assert.equal(getItemValue('Random Stuff', 'IT Services'), 12000);
  assert.equal(getItemValue('Desk', 'เฟอร์นิเจอร์'), 3000);
  assert.equal(getItemValue('Speaker', 'AV Equipments'), 9000);

  // Default fallback
  assert.equal(getItemValue('Pencil', 'Stationery'), 1500);
});
