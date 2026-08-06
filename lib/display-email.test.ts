import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDisplayEmail,
  getInternalAccountHint,
  isInternalEmail,
} from './display-email'

describe('isInternalEmail', () => {
  it('detects registry.internal placeholder emails', () => {
    assert.equal(isInternalEmail('internal+1734567890123.abc12345@registry.internal'), true)
    assert.equal(isInternalEmail('u-a1b2c3d4@registry.internal'), true)
  })

  it('returns false for real emails', () => {
    assert.equal(isInternalEmail('user@company.com'), false)
    assert.equal(isInternalEmail(''), false)
  })
})

describe('formatDisplayEmail', () => {
  it('shows Thai label for internal accounts', () => {
    assert.equal(
      formatDisplayEmail('internal+1734567890123.abc@registry.internal'),
      'บัญชีภายใน (ไม่มีอีเมล)',
    )
  })

  it('returns real email unchanged', () => {
    assert.equal(formatDisplayEmail('  staff@office.go.th  '), 'staff@office.go.th')
  })
})

describe('getInternalAccountHint', () => {
  it('returns a non-empty login hint', () => {
    assert.ok(getInternalAccountHint().includes('ชื่อ-นามสกุล'))
  })
})
