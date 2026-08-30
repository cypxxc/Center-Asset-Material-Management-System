import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from '../../lib/date';

test('formatDate converts date to Thai locale date-only string', () => {
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('invalid-date'), '');
  
  const dateStr = formatDate(new Date('2026-07-02T12:00:00Z'));
  assert.ok(dateStr.includes('2569'));
  assert.ok(dateStr.includes('ก.ค.'));
});
