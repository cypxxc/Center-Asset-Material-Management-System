import test from 'node:test';
import assert from 'node:assert/strict';
import { successResponse, errorResponse } from '../../lib/actions-helper';

test('successResponse returns positive action result structure', () => {
  const result = successResponse('Action succeeded', { id: 123 });
  assert.deepEqual(result, {
    success: true,
    ok: true,
    message: 'Action succeeded',
    data: { id: 123 }
  });
});

test('errorResponse returns negative action result structure', () => {
  const result = errorResponse('Action failed', { name: ['Name is required'] });
  assert.deepEqual(result, {
    success: false,
    ok: false,
    message: 'Action failed',
    error: 'Action failed',
    fieldErrors: { name: ['Name is required'] }
  });
});
