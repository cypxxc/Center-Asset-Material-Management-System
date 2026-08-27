import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { defineTool, runToolPipeline } from './pipeline'
import { type ToolExecutionContext } from './types'

const sampleContext: ToolExecutionContext = {
  actor: { id: 'user-1', role: 'admin', isActive: true },
}

test('runToolPipeline executes valid tool successfully and validates output schema', async () => {
  const echoTool = defineTool({
    name: 'test_echo',
    description: 'Echo test tool',
    category: 'system',
    inputSchema: z.object({ message: z.string() }),
    outputSchema: z.object({ echoed: z.string(), length: z.number() }),
    handler: async (input) => ({
      echoed: input.message,
      length: input.message.length,
    }),
  })

  const result = await runToolPipeline(echoTool, { message: 'hello' }, sampleContext)
  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.echoed, 'hello')
    assert.equal(result.data.length, 5)
    assert.ok(typeof result.durationMs === 'number')
  }
})

test('runToolPipeline returns SCHEMA_VALIDATION_ERROR when input violates inputSchema', async () => {
  const mathTool = defineTool({
    name: 'test_math',
    description: 'Math tool',
    category: 'system',
    inputSchema: z.object({ count: z.number().int().positive() }),
    outputSchema: z.object({ doubled: z.number() }),
    handler: async (input) => ({ doubled: input.count * 2 }),
  })

  const result = await runToolPipeline(mathTool, { count: 'not-a-number' }, sampleContext)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'SCHEMA_VALIDATION_ERROR')
    assert.ok(result.error.fieldErrors?.count)
    assert.ok(result.error.remediationHint.includes('count'))
  }
})

test('runToolPipeline returns UNAUTHORIZED_ERROR when actor role is insufficient', async () => {
  const adminTool = defineTool({
    name: 'test_admin_only',
    description: 'Admin tool',
    category: 'system',
    requiredRole: 'admin',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
  })

  const viewerContext: ToolExecutionContext = {
    actor: { id: 'viewer-1', role: 'viewer', isActive: true },
  }

  const result = await runToolPipeline(adminTool, {}, viewerContext)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'UNAUTHORIZED_ERROR')
  }
})

test('runToolPipeline returns UNAUTHORIZED_ERROR when actor is deactivated', async () => {
  const openTool = defineTool({
    name: 'test_open',
    description: 'Open tool',
    category: 'system',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
  })

  const deactivatedContext: ToolExecutionContext = {
    actor: { id: 'deactivated-1', role: 'admin', isActive: false },
  }

  const result = await runToolPipeline(openTool, {}, deactivatedContext)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'UNAUTHORIZED_ERROR')
    assert.ok(result.error.message.includes('Deactivated'))
  }
})

test('runToolPipeline returns OUTPUT_MISMATCH_ERROR when handler returns invalid structure', async () => {
  const brokenTool = defineTool({
    name: 'test_broken',
    description: 'Broken output tool',
    category: 'system',
    inputSchema: z.object({}),
    outputSchema: z.object({ expectedField: z.string() }),
    // @ts-expect-error deliberately returning invalid payload
    handler: async () => ({ wrongField: 123 }),
  })

  const result = await runToolPipeline(brokenTool, {}, sampleContext)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'OUTPUT_MISMATCH_ERROR')
  }
})

test('runToolPipeline returns TIMEOUT_ERROR when execution exceeds timeoutMs', async () => {
  const slowTool = defineTool({
    name: 'test_slow',
    description: 'Slow tool',
    category: 'system',
    timeoutMs: 50,
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return { ok: true }
    },
  })

  const result = await runToolPipeline(slowTool, {}, sampleContext)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'TIMEOUT_ERROR')
  }
})

test('runToolPipeline handles generic handler exceptions with TOOL_EXECUTION_ERROR', async () => {
  const throwingTool = defineTool({
    name: 'test_throwing',
    description: 'Throwing tool',
    category: 'system',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => {
      throw new Error('Database connection failed')
    },
  })

  const result = await runToolPipeline(throwingTool, {}, sampleContext)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'TOOL_EXECUTION_ERROR')
    assert.equal(result.error.message, 'Database connection failed')
  }
})
