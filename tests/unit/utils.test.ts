import test from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../../lib/utils';

test('cn merges tailwind classes correctly', () => {
  const result = cn('px-2 py-1', 'bg-blue-500', { 'hover:bg-blue-600': true, 'hidden': false });
  assert.equal(result.includes('px-2'), true);
  assert.equal(result.includes('py-1'), true);
  assert.equal(result.includes('bg-blue-500'), true);
  assert.equal(result.includes('hover:bg-blue-600'), true);
  assert.equal(result.includes('hidden'), false);
});
