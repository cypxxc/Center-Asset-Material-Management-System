import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { ToolRegistry, getGlobalToolRegistry, globalToolRegistry } from './registry'
import { defineTool } from './pipeline'
import { type ToolExecutionContext } from './types'

const sampleContext: ToolExecutionContext = {
  actor: { id: 'user-1', role: 'admin', isActive: true },
}

test('ToolRegistry registers and retrieves tools by name', () => {
  const registry = new ToolRegistry()
  const tool = defineTool({
    name: 'test_reg_tool',
    description: 'Test registered tool',
    category: 'system',
    inputSchema: z.object({ msg: z.string() }),
    outputSchema: z.object({ echoed: z.string() }),
    handler: async (input) => ({ echoed: input.msg }),
  })

  registry.register(tool)
  assert.equal(registry.get('test_reg_tool'), tool)
  assert.equal(registry.get('non_existent'), undefined)
  assert.equal(registry.list().length, 1)
  assert.equal(registry.getAll().length, 1)
})

test('ToolRegistry prevents duplicate registration of same tool name', () => {
  const registry = new ToolRegistry()
  const tool = defineTool({
    name: 'duplicate_tool',
    description: 'Duplicate tool',
    category: 'system',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
  })

  registry.register(tool)
  assert.throws(
    () => {
      registry.register(tool)
    },
    {
      message: "Tool 'duplicate_tool' is already registered in ToolRegistry",
    }
  )
})

test('ToolRegistry filters tools by category and by role access', () => {
  const registry = new ToolRegistry()
  const publicTool = defineTool({
    name: 'pub_tool',
    description: 'Public tool',
    category: 'metadata',
    requiredRole: 'viewer',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
  })

  const staffTool = defineTool({
    name: 'staff_tool',
    description: 'Staff tool',
    category: 'inventory',
    requiredRole: 'staff',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
  })

  const adminTool = defineTool({
    name: 'adm_tool',
    description: 'Admin tool',
    category: 'security',
    requiredRole: 'admin',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
  })

  const unauthenticatedTool = defineTool({
    name: 'anon_tool',
    description: 'Anonymous tool',
    category: 'system',
    requiredRole: 'public',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
  })

  registry.register(publicTool)
  registry.register(staffTool)
  registry.register(adminTool)
  registry.register(unauthenticatedTool)

  assert.equal(registry.listByCategory('metadata').length, 1)
  assert.equal(registry.listByCategory('security').length, 1)
  assert.equal(registry.listByCategory('inventory').length, 1)
  assert.equal(registry.getByCategory('system').length, 1)

  // Unauthenticated / public only
  const anonTools = registry.listForRole(undefined)
  assert.equal(anonTools.length, 1)
  assert.equal(anonTools[0].name, 'anon_tool')

  // Viewer role should see public + viewer tools
  const viewerTools = registry.listForRole('viewer')
  assert.equal(viewerTools.length, 2)
  assert.ok(viewerTools.some((t) => t.name === 'pub_tool'))
  assert.ok(viewerTools.some((t) => t.name === 'anon_tool'))

  // Staff role should see public + viewer + staff tools
  const staffTools = registry.listForRole('staff')
  assert.equal(staffTools.length, 3)
  assert.ok(staffTools.some((t) => t.name === 'staff_tool'))
  assert.ok(staffTools.some((t) => t.name === 'pub_tool'))
  assert.ok(staffTools.some((t) => t.name === 'anon_tool'))

  // Admin role should see all tools
  const adminTools = registry.listForRole('admin')
  assert.equal(adminTools.length, 4)
})

test('ToolRegistry executes tool through runToolPipeline', async () => {
  const registry = new ToolRegistry()
  const tool = defineTool({
    name: 'calc_square',
    description: 'Square calculator',
    category: 'system',
    inputSchema: z.object({ n: z.number() }),
    outputSchema: z.object({ squared: z.number() }),
    handler: async (input) => ({ squared: input.n * input.n }),
  })

  registry.register(tool)
  const result = await registry.execute('calc_square', { n: 4 }, sampleContext)
  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.squared, 16)
  }

  // Unknown tool returns error
  const notFoundResult = await registry.execute('unknown_tool', {}, sampleContext)
  assert.equal(notFoundResult.success, false)
  if (!notFoundResult.success) {
    assert.equal(notFoundResult.error.code, 'TOOL_EXECUTION_ERROR')
    assert.ok(notFoundResult.error.message.includes('not found'))
    assert.ok(notFoundResult.error.remediationHint.includes('calc_square'))
  }
})

test('ToolRegistry provides OpenAPI declarations and global singleton', () => {
  const registry = new ToolRegistry()
  const schema = z.object({ text: z.string() })
  registry.register(
    defineTool({
      name: 'decl_tool',
      description: 'Declaration test',
      category: 'system',
      inputSchema: schema,
      outputSchema: z.object({ result: z.string() }),
      handler: async (input) => ({ result: input.text }),
    })
  )

  const declarations = registry.getOpenApiToolsDeclaration()
  assert.equal(declarations.length, 1)
  assert.equal(declarations[0].name, 'decl_tool')
  assert.equal(declarations[0].description, 'Declaration test')
  assert.equal(declarations[0].inputSchema, schema)

  const global1 = getGlobalToolRegistry()
  const global2 = getGlobalToolRegistry()
  assert.equal(global1, global2)
  assert.equal(globalToolRegistry, global1)
})
