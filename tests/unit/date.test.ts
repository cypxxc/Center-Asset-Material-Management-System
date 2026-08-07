import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatDate } from '../../lib/date';

test('formatDateTime converts date to Thai locale date time string', () => {
  assert.equal(formatDateTime(''), '');
  assert.equal(formatDateTime('invalid-date'), '');
  
  const dateTimeStr = formatDateTime(new Date('2026-07-02T12:00:00Z'));
  assert.ok(dateTimeStr.includes('2569'));
  assert.ok(dateTimeStr.includes('ก.ค.'));
  assert.ok(dateTimeStr.includes(':'));
});

test('formatDate converts date to Thai locale date-only string', () => {
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('invalid-date'), '');
  
  const dateStr = formatDate(new Date('2026-07-02T12:00:00Z'));
  assert.ok(dateStr.includes('2569'));
  assert.ok(dateStr.includes('ก.ค.'));
});
