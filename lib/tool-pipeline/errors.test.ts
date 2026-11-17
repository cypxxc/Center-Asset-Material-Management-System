import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { ToolPipelineError, formatZodRemediationHint } from './errors'

test('ToolPipelineError formats standard error payload correctly', () => {
  const error = new ToolPipelineError({
    code: 'SCHEMA_VALIDATION_ERROR',
    message: "Input validation failed for tool 'create_item'",
    fieldErrors: {
      quantity: ['Expected number, received string'],
    },
    remediationHint: "Provide field 'quantity' as a number.",
  })

  const json = error.toJSON()
  assert.equal(json.code, 'SCHEMA_VALIDATION_ERROR')
  assert.equal(json.message, "Input validation failed for tool 'create_item'")
  assert.deepEqual(json.fieldErrors, { quantity: ['Expected number, received string'] })
  assert.equal(json.remediationHint, "Provide field 'quantity' as a number.")
})

test('formatZodRemediationHint generates actionable hints for missing and invalid fields', () => {
  const schema = z.object({
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    type: z.enum(['asset', 'supply']),
  })

  const parseResult = schema.safeParse({
    name: '',
    quantity: 'invalid',
    type: 'unknown',
  })

  assert.equal(parseResult.success, false)
  if (!parseResult.success) {
    const hint = formatZodRemediationHint(parseResult.error)
    assert.ok(hint.includes('quantity'))
    assert.ok(hint.includes('type'))
  }
})
