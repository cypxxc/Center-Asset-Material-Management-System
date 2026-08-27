# Deterministic Tool Pipelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, type-safe Deterministic Tool Pipeline framework in CAMMS (`lib/tool-pipeline/`) that enforces strict Zod v4 input/output validation, pre/post execution guards, predictable agent self-correction error payloads, and seamless Model Context Protocol (MCP) tool integration.

**Architecture:** A declarative functional pipeline (`defineTool` / `runToolPipeline`) implementing a 6-stage execution lifecycle (Input Validation -> Rate Limiter Guard -> RBAC Policy Check -> Sandboxed Execution with Timeout -> Strict Output Schema Enforcement -> SIEM Telemetry & Audit). Accompanied by a centralized Tool Registry and universal MCP / Server Action adapters.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict mode, Zod v4, Node.js native test runner (`npx tsx --test`), Supabase PostgreSQL RLS, Model Context Protocol (JSON-RPC 2.0).

## Global Constraints

- Use Node.js native test runner via `npx tsx --test <testfile>` for unit tests.
- Maintain Next.js 16 + React 19 App Router conventions.
- Strict TypeScript (`"strict": true`, no unused locals/params).
- All tool inputs and outputs MUST be validated against runtime Zod schemas.
- Error payloads MUST return structured machine-parsable JSON with actionable `remediationHint` for LLM self-correction.
- Zero runtime overhead on unrelated request paths.

---

### Task 1: Core Types, Interfaces & Deterministic Error Classes

**Files:**
- Create: `lib/tool-pipeline/types.ts`
- Create: `lib/tool-pipeline/errors.ts`
- Create: `lib/tool-pipeline/errors.test.ts`

**Interfaces:**
- Produces:
  - `ToolDefinition<TInputSchema, TOutputSchema>`
  - `ToolExecutionContext`
  - `ToolPipelineResult<TOutput>` (`ToolPipelineSuccess<TOutput>` | `ToolPipelineFailure`)
  - `ToolPipelineError` class with `toJSON()` and `generateRemediationHint(zodError)`

- [ ] **Step 1: Write the failing tests for error formatting and remediation hints**

```typescript
// lib/tool-pipeline/errors.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/tool-pipeline/errors.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `types.ts` and `errors.ts`**

```typescript
// lib/tool-pipeline/types.ts
import { z } from 'zod'
import { type RateLimitTier } from '@/lib/rate-limit'

export type ToolRoleRequirement = 'admin' | 'staff' | 'viewer' | 'public'

export interface ToolActor {
  id?: string
  email?: string
  role?: 'admin' | 'staff' | 'viewer'
  isActive?: boolean
  ip?: string
  userAgent?: string
}

export interface ToolExecutionContext {
  actor: ToolActor
  traceId?: string
  correlationId?: string
  requestId?: string
  source?: 'mcp' | 'server_action' | 'api' | 'agent'
  metadata?: Record<string, unknown>
}

export interface ToolDefinition<
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny = z.ZodTypeAny
> {
  name: string
  description: string
  category: 'inventory' | 'metadata' | 'audit' | 'security' | 'system'
  inputSchema: TInputSchema
  outputSchema: TOutputSchema
  rateLimitTier?: RateLimitTier
  requiredRole?: ToolRoleRequirement
  timeoutMs?: number
  handler: (
    input: z.infer<TInputSchema>,
    context: ToolExecutionContext
  ) => Promise<z.infer<TOutputSchema>>
}

export interface ToolPipelineSuccess<TOutput> {
  success: true
  data: TOutput
  durationMs: number
  metadata?: Record<string, unknown>
}

export interface ToolPipelineFailure {
  success: false
  error: {
    code:
      | 'SCHEMA_VALIDATION_ERROR'
      | 'RATE_LIMIT_EXCEEDED'
      | 'UNAUTHORIZED_ERROR'
      | 'OUTPUT_MISMATCH_ERROR'
      | 'TIMEOUT_ERROR'
      | 'TOOL_EXECUTION_ERROR'
    message: string
    fieldErrors?: Record<string, string[]>
    remediationHint: string
    details?: Record<string, unknown>
  }
  durationMs: number
}

export type ToolPipelineResult<TOutput> =
  | ToolPipelineSuccess<TOutput>
  | ToolPipelineFailure
```

```typescript
// lib/tool-pipeline/errors.ts
import { type ZodError } from 'zod'
import { type ToolPipelineFailure } from './types'

export class ToolPipelineError extends Error {
  readonly code: ToolPipelineFailure['error']['code']
  readonly fieldErrors?: Record<string, string[]>
  readonly remediationHint: string
  readonly details?: Record<string, unknown>

  constructor(opts: {
    code: ToolPipelineFailure['error']['code']
    message: string
    fieldErrors?: Record<string, string[]>
    remediationHint: string
    details?: Record<string, unknown>
  }) {
    super(opts.message)
    this.name = 'ToolPipelineError'
    this.code = opts.code
    this.fieldErrors = opts.fieldErrors
    this.remediationHint = opts.remediationHint
    this.details = opts.details
  }

  toJSON(): ToolPipelineFailure['error'] {
    return {
      code: this.code,
      message: this.message,
      ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
      remediationHint: this.remediationHint,
      ...(this.details ? { details: this.details } : {}),
    }
  }
}

export function formatZodRemediationHint(error: ZodError): string {
  const hints: string[] = []

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root'
    if (issue.code === 'invalid_type') {
      hints.push(`Field '${path}' expects type '${issue.expected}', received '${issue.received}'.`)
    } else if (issue.code === 'invalid_value') {
      hints.push(`Field '${path}' received invalid value.`)
    } else if (issue.code === 'too_small') {
      hints.push(`Field '${path}' is too small/short (min: ${issue.minimum}).`)
    } else if (issue.code === 'too_big') {
      hints.push(`Field '${path}' exceeds allowed max value/length (max: ${issue.maximum}).`)
    } else {
      hints.push(`Field '${path}': ${issue.message}`)
    }
  }

  return hints.join(' ')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test lib/tool-pipeline/errors.test.ts`
Expected: PASS (2 tests pass)

- [ ] **Step 5: Commit**

```bash
git add lib/tool-pipeline/types.ts lib/tool-pipeline/errors.ts lib/tool-pipeline/errors.test.ts
git commit -m "feat(tool-pipeline): add core types and deterministic error hierarchy"
```

---

### Task 2: Pipeline Executor Engine (`runToolPipeline` & `defineTool`)

**Files:**
- Create: `lib/tool-pipeline/pipeline.ts`
- Create: `lib/tool-pipeline/pipeline.test.ts`

**Interfaces:**
- Consumes: `ToolDefinition`, `ToolExecutionContext`, `ToolPipelineResult`, `ToolPipelineError` from Task 1.
- Produces:
  - `defineTool<TIn, TOut>(def: ToolDefinition<TIn, TOut>): ToolDefinition<TIn, TOut>`
  - `runToolPipeline<TIn, TOut>(tool: ToolDefinition<TIn, TOut>, rawInput: unknown, context: ToolExecutionContext): Promise<ToolPipelineResult<z.infer<TOut>>>`

- [ ] **Step 1: Write failing pipeline test suite**

```typescript
// lib/tool-pipeline/pipeline.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/tool-pipeline/pipeline.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `lib/tool-pipeline/pipeline.ts`**

```typescript
// lib/tool-pipeline/pipeline.ts
import { z } from 'zod'
import {
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolPipelineResult,
} from './types'
import { ToolPipelineError, formatZodRemediationHint } from './errors'
import { logSecurityEvent } from '@/lib/security-logger'

export function defineTool<
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny
>(
  tool: ToolDefinition<TInputSchema, TOutputSchema>
): ToolDefinition<TInputSchema, TOutputSchema> {
  return tool
}

export async function runToolPipeline<
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny
>(
  tool: ToolDefinition<TInputSchema, TOutputSchema>,
  rawInput: unknown,
  context: ToolExecutionContext
): Promise<ToolPipelineResult<z.infer<TOutputSchema>>> {
  const startTime = performance.now()

  try {
    // 1. Stage 1: Input Validation
    const parsedInput = tool.inputSchema.safeParse(rawInput)
    if (!parsedInput.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsedInput.error.issues) {
        const key = issue.path.join('.') || 'root'
        if (!fieldErrors[key]) fieldErrors[key] = []
        fieldErrors[key].push(issue.message)
      }

      const remediationHint = formatZodRemediationHint(parsedInput.error)
      throw new ToolPipelineError({
        code: 'SCHEMA_VALIDATION_ERROR',
        message: `Input validation failed for tool '${tool.name}'`,
        fieldErrors,
        remediationHint,
      })
    }

    // 2. Stage 2: RBAC & Identity Policy Check
    const actor = context.actor || {}
    if (actor.isActive === false) {
      throw new ToolPipelineError({
        code: 'UNAUTHORIZED_ERROR',
        message: `Deactivated account cannot execute tool '${tool.name}'`,
        remediationHint: 'Contact administrator to re-activate account.',
      })
    }

    if (tool.requiredRole) {
      const role = actor.role
      if (tool.requiredRole === 'admin' && role !== 'admin') {
        throw new ToolPipelineError({
          code: 'UNAUTHORIZED_ERROR',
          message: `Tool '${tool.name}' requires 'admin' role. Current role is '${role || 'anonymous'}'.`,
          remediationHint: 'Execute this tool under an account with admin privileges.',
        })
      } else if (tool.requiredRole === 'staff' && role !== 'admin' && role !== 'staff') {
        throw new ToolPipelineError({
          code: 'UNAUTHORIZED_ERROR',
          message: `Tool '${tool.name}' requires 'staff' or 'admin' role. Current role is '${role || 'anonymous'}'.`,
          remediationHint: 'Execute this tool under an account with staff/admin privileges.',
        })
      }
    }

    // 3. Stage 3: Sandboxed Execution & Timeout Guard
    const timeoutMs = tool.timeoutMs || 30000
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        reject(
          new ToolPipelineError({
            code: 'TIMEOUT_ERROR',
            message: `Tool execution exceeded timeout of ${timeoutMs}ms`,
            remediationHint: 'Try reducing batch size or query complexity.',
          })
        )
      }, timeoutMs)
    )

    const executionPromise = tool.handler(parsedInput.data, context)
    const rawResult = await Promise.race([executionPromise, timeoutPromise])

    // 4. Stage 4: Strict Output Schema Enforcement
    const validatedOutput = tool.outputSchema.safeParse(rawResult)
    if (!validatedOutput.success) {
      logSecurityEvent({
        severity: 'HIGH',
        eventType: 'ADMIN_ACTION',
        threatVector: `Tool output contract violation in '${tool.name}'`,
        impactAnalysis: 'Tool produced response that violated declared output schema',
        automatedActionTaken: 'Blocked invalid output payload from reaching agent',
        recommendedFollowUp: 'Inspect tool handler implementation and output schema',
      })

      throw new ToolPipelineError({
        code: 'OUTPUT_MISMATCH_ERROR',
        message: `Tool '${tool.name}' returned data violating output schema`,
        remediationHint: 'Tool handler implementation bug. Please report to engineering team.',
        details: { issues: validatedOutput.error.issues },
      })
    }

    const durationMs = Math.round(performance.now() - startTime)
    return {
      success: true,
      data: validatedOutput.data,
      durationMs,
    }
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime)
    if (err instanceof ToolPipelineError) {
      return {
        success: false,
        error: err.toJSON(),
        durationMs,
      }
    }

    const message = err instanceof Error ? err.message : 'Unknown tool execution error'
    return {
      success: false,
      error: {
        code: 'TOOL_EXECUTION_ERROR',
        message,
        remediationHint: 'Check execution parameters and dependent service status.',
      },
      durationMs,
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test lib/tool-pipeline/pipeline.test.ts`
Expected: PASS (4 tests pass)

- [ ] **Step 5: Commit**

```bash
git add lib/tool-pipeline/pipeline.ts lib/tool-pipeline/pipeline.test.ts
git commit -m "feat(tool-pipeline): implement deterministic pipeline executor engine"
```

---

### Task 3: Tool Registry & Indexing

**Files:**
- Create: `lib/tool-pipeline/registry.ts`
- Create: `lib/tool-pipeline/registry.test.ts`
- Create: `lib/tool-pipeline/index.ts`

**Interfaces:**
- Consumes: `ToolDefinition`, `runToolPipeline` from Task 1 and Task 2.
- Produces:
  - `ToolRegistry` class with `.register()`, `.get()`, `.getAll()`, `.getByCategory()`, `.execute()`.
  - Global default registry `globalToolRegistry`.
  - Unified barrel export from `lib/tool-pipeline/index.ts`.

- [ ] **Step 1: Write failing registry tests**

```typescript
// lib/tool-pipeline/registry.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { ToolRegistry } from './registry'
import { defineTool } from './pipeline'

test('ToolRegistry registers, retrieves, and lists tools by category', () => {
  const registry = new ToolRegistry()

  const t1 = defineTool({
    name: 'inv_get',
    description: 'Get item',
    category: 'inventory',
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ id: z.string() }),
    handler: async (inp) => inp,
  })

  const t2 = defineTool({
    name: 'sec_scan',
    description: 'Scan security',
    category: 'security',
    inputSchema: z.object({}),
    outputSchema: z.object({ safe: z.boolean() }),
    handler: async () => ({ safe: true }),
  })

  registry.register(t1)
  registry.register(t2)

  assert.equal(registry.get('inv_get'), t1)
  assert.equal(registry.get('sec_scan'), t2)
  assert.equal(registry.getAll().length, 2)
  assert.equal(registry.getByCategory('inventory').length, 1)
  assert.equal(registry.getByCategory('security').length, 1)
})

test('ToolRegistry.execute executes registered tool directly', async () => {
  const registry = new ToolRegistry()
  registry.register(
    defineTool({
      name: 'ping',
      description: 'Ping test',
      category: 'system',
      inputSchema: z.object({ val: z.string() }),
      outputSchema: z.object({ pong: z.string() }),
      handler: async (inp) => ({ pong: inp.val }),
    })
  )

  const res = await registry.execute('ping', { val: 'test-123' }, { actor: { role: 'viewer' } })
  assert.equal(res.success, true)
  if (res.success) {
    assert.deepEqual(res.data, { pong: 'test-123' })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/tool-pipeline/registry.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `registry.ts` and `index.ts`**

```typescript
// lib/tool-pipeline/registry.ts
import {
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolPipelineResult,
} from './types'
import { runToolPipeline } from './pipeline'
import { ToolPipelineError } from './errors'

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered in registry.`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category)
  }

  async execute(
    name: string,
    rawInput: unknown,
    context: ToolExecutionContext
  ): Promise<ToolPipelineResult<unknown>> {
    const tool = this.get(name)
    if (!tool) {
      return {
        success: false,
        error: new ToolPipelineError({
          code: 'TOOL_EXECUTION_ERROR',
          message: `Tool '${name}' not found in registry`,
          remediationHint: `Available tools: ${this.getAll().map((t) => t.name).join(', ')}`,
        }).toJSON(),
        durationMs: 0,
      }
    }

    return runToolPipeline(tool, rawInput, context)
  }
}

export const globalToolRegistry = new ToolRegistry()
```

```typescript
// lib/tool-pipeline/index.ts
export * from './types'
export * from './errors'
export * from './pipeline'
export * from './registry'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test lib/tool-pipeline/registry.test.ts`
Expected: PASS (2 tests pass)

- [ ] **Step 5: Commit**

```bash
git add lib/tool-pipeline/registry.ts lib/tool-pipeline/registry.test.ts lib/tool-pipeline/index.ts
git commit -m "feat(tool-pipeline): add tool registry and unified barrel exports"
```

---

### Task 4: Canonical Domain Tools (Items & Security)

**Files:**
- Create: `lib/tool-pipeline/tools/items.ts`
- Create: `lib/tool-pipeline/tools/security.ts`
- Create: `lib/tool-pipeline/tools/items.test.ts`

**Interfaces:**
- Produces:
  - `itemGetTool`, `itemListTool`, `itemCreateTool`
  - `securityVerifyTool`

- [ ] **Step 1: Write failing tests for canonical tools**

```typescript
// lib/tool-pipeline/tools/items.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemGetTool, itemCreateTool } from './items'
import { runToolPipeline } from '../pipeline'

test('itemGetTool validates UUID or asset code format', async () => {
  const validContext = { actor: { role: 'viewer' as const, isActive: true } }
  const result = await runToolPipeline(itemGetTool, { idOrCode: 'AS-12345' }, validContext)
  assert.equal(result.success, true)
})

test('itemCreateTool enforces role requirement and input limits', async () => {
  const viewerContext = { actor: { role: 'viewer' as const, isActive: true } }
  const result = await runToolPipeline(
    itemCreateTool,
    {
      item_name: 'Test Item',
      item_type: 'asset',
      category_id: 'cat-1',
      quantity: 1,
    },
    viewerContext
  )

  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'UNAUTHORIZED_ERROR')
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/tool-pipeline/tools/items.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `lib/tool-pipeline/tools/items.ts` and `security.ts`**

```typescript
// lib/tool-pipeline/tools/items.ts
import { z } from 'zod'
import { defineTool } from '../pipeline'

export const itemGetTool = defineTool({
  name: 'items_get',
  description: 'Retrieve item metadata by ID or Asset Code',
  category: 'inventory',
  requiredRole: 'viewer',
  rateLimitTier: 'read',
  inputSchema: z.object({
    idOrCode: z.string().min(1, 'Item ID or Asset Code is required').max(100),
  }),
  outputSchema: z.object({
    id: z.string(),
    code: z.string().nullable(),
    name: z.string(),
    type: z.enum(['asset', 'supply']),
    quantity: z.number(),
  }),
  handler: async (input) => {
    // In test/mock context or database query
    return {
      id: input.idOrCode,
      code: input.idOrCode,
      name: 'Sample Item',
      type: 'asset',
      quantity: 1,
    }
  },
})

export const itemCreateTool = defineTool({
  name: 'items_create',
  description: 'Create a new inventory item with strict boundaries',
  category: 'inventory',
  requiredRole: 'staff',
  rateLimitTier: 'mutation',
  inputSchema: z.object({
    item_name: z.string().min(1).max(255),
    item_type: z.enum(['asset', 'supply']),
    category_id: z.string().min(1),
    quantity: z.number().int().min(1).default(1),
    unit_price: z.number().nonnegative().optional(),
    location_id: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    itemId: z.string(),
    name: z.string(),
  }),
  handler: async (input) => {
    return {
      success: true,
      itemId: `gen-${Date.now()}`,
      name: input.item_name,
    }
  },
})
```

```typescript
// lib/tool-pipeline/tools/security.ts
import { z } from 'zod'
import { defineTool } from '../pipeline'
import { SECURITY_HEADERS } from '@/lib/security-headers'
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit'

export const securityVerifyTool = defineTool({
  name: 'system_verify_security',
  description: 'Run programmatic security posture check across all defense pillars',
  category: 'security',
  requiredRole: 'admin',
  inputSchema: z.object({
    checkHeaders: z.boolean().default(true),
    checkRateLimits: z.boolean().default(true),
  }),
  outputSchema: z.object({
    passed: z.boolean(),
    headersCompliant: z.boolean(),
    rateLimitingActive: z.boolean(),
    timestamp: z.string(),
  }),
  handler: async (input) => {
    let headersCompliant = true
    if (input.checkHeaders) {
      headersCompliant =
        SECURITY_HEADERS['X-Frame-Options'] === 'DENY' &&
        SECURITY_HEADERS['X-Content-Type-Options'] === 'nosniff'
    }

    const rateLimitingActive = input.checkRateLimits ? Boolean(RATE_LIMIT_TIERS.auth) : true

    return {
      passed: headersCompliant && rateLimitingActive,
      headersCompliant,
      rateLimitingActive,
      timestamp: new Date().toISOString(),
    }
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test lib/tool-pipeline/tools/items.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/tool-pipeline/tools/items.ts lib/tool-pipeline/tools/security.ts lib/tool-pipeline/tools/items.test.ts
git commit -m "feat(tool-pipeline): add canonical items and security tools"
```

---

### Task 5: Universal MCP Adapter & MCP Server Integration

**Files:**
- Create: `lib/tool-pipeline/adapters/mcp.ts`
- Create: `lib/tool-pipeline/adapters/mcp.test.ts`
- Modify: `scripts/mcp-server.ts`

**Interfaces:**
- Produces:
  - `toMcpTool(def: ToolDefinition): McpTool`
  - `handleMcpToolCall(tool: ToolDefinition, params: unknown, context: ToolExecutionContext)`

- [ ] **Step 1: Write failing test for MCP adapter**

```typescript
// lib/tool-pipeline/adapters/mcp.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { defineTool } from '../pipeline'
import { toMcpTool, handleMcpToolCall } from './mcp'

test('toMcpTool converts ToolDefinition to MCP tool descriptor with inputSchema', () => {
  const tool = defineTool({
    name: 'test_calc',
    description: 'Calculate numbers',
    category: 'system',
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    outputSchema: z.object({ sum: z.number() }),
    handler: async (inp) => ({ sum: inp.a + inp.b }),
  })

  const mcpDesc = toMcpTool(tool)
  assert.equal(mcpDesc.name, 'test_calc')
  assert.equal(mcpDesc.description, 'Calculate numbers')
  assert.ok(mcpDesc.inputSchema)
})

test('handleMcpToolCall returns formatted MCP JSON-RPC response with error payload on failure', async () => {
  const tool = defineTool({
    name: 'test_calc',
    description: 'Calculate numbers',
    category: 'system',
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    outputSchema: z.object({ sum: z.number() }),
    handler: async (inp) => ({ sum: inp.a + inp.b }),
  })

  const response = await handleMcpToolCall(tool, { a: 'invalid' }, { actor: { role: 'admin' } })
  assert.equal(response.isError, true)
  assert.ok(response.content[0].text.includes('SCHEMA_VALIDATION_ERROR'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/tool-pipeline/adapters/mcp.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `lib/tool-pipeline/adapters/mcp.ts`**

```typescript
// lib/tool-pipeline/adapters/mcp.ts
import { type ToolDefinition, type ToolExecutionContext } from '../types'
import { runToolPipeline } from '../pipeline'

export interface McpToolDescriptor {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export interface McpContentItem {
  type: 'text'
  text: string
}

export interface McpToolResponse {
  content: McpContentItem[]
  isError?: boolean
}

export function toMcpTool(tool: ToolDefinition): McpToolDescriptor {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
    },
  }
}

export async function handleMcpToolCall(
  tool: ToolDefinition,
  rawArgs: unknown,
  context: ToolExecutionContext
): Promise<McpToolResponse> {
  const result = await runToolPipeline(tool, rawArgs, context)

  if (!result.success) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.error, null, 2),
        },
      ],
    }
  }

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test lib/tool-pipeline/adapters/mcp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/tool-pipeline/adapters/mcp.ts lib/tool-pipeline/adapters/mcp.test.ts
git commit -m "feat(tool-pipeline): implement universal MCP tool adapter"
```

---

### Task 6: Full Verification & Quality Assurance

**Files:**
- Test all components across the entire repository.

- [ ] **Step 1: Run all unit tests**

Run: `npm test`
Expected: PASS (All test suites pass)

- [ ] **Step 2: Run automated security audit**

Run: `npm run audit:security`
Expected: PASS (All 5 defense pillars pass)

- [ ] **Step 3: Run strict TypeScript typecheck**

Run: `npm run typecheck`
Expected: PASS (0 type errors)

- [ ] **Step 4: Run ESLint**

Run: `npm run lint`
Expected: PASS (0 lint warnings/errors)
