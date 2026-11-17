import test from 'node:test'
import assert from 'node:assert/strict'
import { generateQrCodeMatrix, generateQrCodeSvgPath } from './qr-code'

test('generateQrCodeMatrix generates a valid square boolean grid for item URLs', () => {
  const url = 'https://camms.app/items/123e4567-e89b-12d3-a456-426614174000'
  const matrix = generateQrCodeMatrix(url)

  assert.ok(Array.isArray(matrix))
  assert.ok(matrix.length >= 21) // Minimum QR size is Version 1 (21x21)
  assert.equal(matrix.length, matrix[0].length) // Must be square

  // Finder pattern top-left check (7x7 outer boundary)
  assert.equal(matrix[0][0], true)
  assert.equal(matrix[0][6], true)
  assert.equal(matrix[6][0], true)
  assert.equal(matrix[6][6], true)
})

test('generateQrCodeSvgPath produces scalable SVG path data string', () => {
  const url = 'https://camms.app/items/AST-001'
  const result = generateQrCodeSvgPath(url)

  assert.ok(typeof result.path === 'string')
  assert.ok(result.path.length > 0)
  assert.ok(result.size >= 21)
  assert.ok(result.path.includes('M'), 'Path should contain SVG Move commands')
})

test('generateQrCodeMatrix is deterministic for identical inputs', () => {
  const text = 'https://camms.app/items/test-id'
  const m1 = generateQrCodeMatrix(text)
  const m2 = generateQrCodeMatrix(text)

  assert.deepEqual(m1, m2)
})
