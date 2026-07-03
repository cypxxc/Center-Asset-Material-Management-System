import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from '../../lib/date/format-date';
import { formatDateTime, formatTime } from '../../lib/date/format-date-time';
import { formatRelativeDate } from '../../lib/date/relative-date';

test('formatDate converts date to Thai locale date string', () => {
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('invalid-date'), '');
  
  // 2026-07-02 under Asia/Bangkok time zone in th-TH locale should show Buddhist Era year 2569
  const dateStr = formatDate(new Date('2026-07-02T12:00:00Z'));
  assert.ok(dateStr.includes('2569'));
  assert.ok(dateStr.includes('ก.ค.'));
});

test('formatDateTime converts date to Thai locale date time string', () => {
  assert.equal(formatDateTime(''), '');
  assert.equal(formatDateTime('invalid-date'), '');
  
  const dateTimeStr = formatDateTime(new Date('2026-07-02T12:00:00Z'));
  assert.ok(dateTimeStr.includes('2569'));
  assert.ok(dateTimeStr.includes('ก.ค.'));
  assert.ok(dateTimeStr.includes(':'));
});

test('formatTime converts date to Thai locale time string', () => {
  assert.equal(formatTime(''), '');
  assert.equal(formatTime('invalid-date'), '');
  
  const timeStr = formatTime(new Date('2026-07-02T12:30:00Z'));
  assert.ok(timeStr.includes(':'));
});

test('formatRelativeDate returns human-readable relative text', () => {
  assert.equal(formatRelativeDate(''), '');
  assert.equal(formatRelativeDate('invalid-date'), '');

  const now = new Date();
  
  // Just now
  assert.equal(formatRelativeDate(now), 'เมื่อครู่');

  // Minutes ago
  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
  assert.equal(formatRelativeDate(tenMinsAgo), 'เมื่อ 10 นาทีที่แล้ว');

  // Hours ago
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  assert.equal(formatRelativeDate(twoHoursAgo), 'เมื่อ 2 ชั่วโมงที่แล้ว');

  // Days ago
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  assert.equal(formatRelativeDate(threeDaysAgo), 'เมื่อ 3 วันที่แล้ว');

  // Old date fallback to formatted absolute date (2000 AD -> 2543 BE)
  const ancientDate = new Date('2000-01-01T00:00:00Z');
  assert.ok(formatRelativeDate(ancientDate).includes('2543'));
});
