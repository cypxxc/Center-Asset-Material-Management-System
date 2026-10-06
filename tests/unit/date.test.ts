import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatDateTime } from '../../lib/date';

test('formatDate converts date to Thai locale date-only string', () => {
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('invalid-date'), '');
  
  const dateStr = formatDate(new Date('2026-07-02T12:00:00Z'));
  assert.ok(dateStr.includes('2569'));
  assert.ok(dateStr.includes('ก.ค.'));
});

test('formatDateTime converts date to Thai locale date and time string with Bangkok timezone', () => {
  assert.equal(formatDateTime(''), '');
  assert.equal(formatDateTime('invalid-date'), '');

  // 12:00:00 UTC = 19:00:00 Asia/Bangkok (+7)
  const dateTimeStr = formatDateTime(new Date('2026-07-02T12:00:00Z'));
  assert.ok(dateTimeStr.includes('2569'));
  assert.ok(dateTimeStr.includes('ก.ค.'));
  assert.ok(dateTimeStr.includes('19:00:00'));
});

