import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, isStaff, isViewer, canWrite, canDelete, canManageSettings, canManageTrash } from '../../lib/permissions';

test('permissions helper identify correct roles', () => {
  assert.equal(isAdmin('admin'), true);
  assert.equal(isAdmin('staff'), false);
  assert.equal(isAdmin('viewer'), false);
  assert.equal(isAdmin(null), false);
  assert.equal(isAdmin(undefined), false);

  assert.equal(isStaff('staff'), true);
  assert.equal(isStaff('admin'), false);

  assert.equal(isViewer('viewer'), true);
  assert.equal(isViewer('admin'), false);
});

test('permissions helper determine correct write rights', () => {
  assert.equal(canWrite('admin'), true);
  assert.equal(canWrite('staff'), true);
  assert.equal(canWrite('viewer'), false);
  assert.equal(canWrite(null), false);
});

test('permissions helper determine correct delete rights', () => {
  assert.equal(canDelete('admin'), true);
  assert.equal(canDelete('staff'), false);
  assert.equal(canDelete('viewer'), false);
});

test('permissions helper determine correct settings management rights', () => {
  assert.equal(canManageSettings('admin'), true);
  assert.equal(canManageSettings('staff'), false);
  assert.equal(canManageSettings('viewer'), false);
});

test('permissions helper determine correct trash management rights', () => {
  assert.equal(canManageTrash('admin'), true);
  assert.equal(canManageTrash('staff'), false);
  assert.equal(canManageTrash('viewer'), false);
});
