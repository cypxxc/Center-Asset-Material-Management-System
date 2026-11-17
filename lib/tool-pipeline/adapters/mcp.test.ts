import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createMcpAdapter } from './mcp'
import { ToolRegistry } from '../registry'
import { defineTool } from '../pipeline'
import { type ToolExecutionContext } from '../types'

const sampleContext: ToolExecutionContext = {
  actor: { id: 'admin-1', role: 'admin', isActive: true },
}

test('createMcpAdapter exports list of tools for MCP discovery', () => {
  const registry = new ToolRegistry()
  registry.register(
    defineTool({
      name: 'echo_tool',
      description: 'Echoes input',
      category: 'system',
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ echoed: z.string() }),
      handler: async (input) => ({ echoed: input.text }),
    })
  )

  const adapter = createMcpAdapter(registry)
  const listResult = adapter.handleToolsList('admin')
  assert.equal(listResult.tools.length, 1)
  assert.equal(listResult.tools[0].name, 'echo_tool')
  assert.equal(listResult.tools[0].description, 'Echoes input')
})

test('createMcpAdapter handles tools/call and returns formatted MCP text content', async () => {
  const registry = new ToolRegistry()
  registry.register(
    defineTool({
      name: 'greet_user',
      description: 'Greets a user',
      category: 'system',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      handler: async (input) => ({ greeting: `Hello, ${input.name}!` }),
    })
  )

  const adapter = createMcpAdapter(registry)
  const callResult = await adapter.handleToolsCall('greet_user', { name: 'Alice' }, sampleContext)
  assert.equal(callResult.isError, false)
  assert.equal(callResult.content[0].type, 'text')
  assert.ok(callResult.content[0].text.includes('Hello, Alice!'))
})

test('createMcpAdapter handles validation failure with structured remediation hint in MCP format', async () => {
  const registry = new ToolRegistry()
  registry.register(
    defineTool({
      name: 'number_doubler',
      description: 'Doubles a number',
      category: 'system',
      inputSchema: z.object({ num: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
      handler: async (input) => ({ doubled: input.num * 2 }),
    })
  )

  const adapter = createMcpAdapter(registry)
  // Passing invalid type (string instead of number)
  const callResult = await adapter.handleToolsCall('number_doubler', { num: 'not_a_number' }, sampleContext)
  assert.equal(callResult.isError, true)
  assert.equal(callResult.content[0].type, 'text')
  assert.ok(callResult.content[0].text.includes('SCHEMA_VALIDATION_ERROR'))
  assert.ok(callResult.content[0].text.includes('Remediation:'))
})
