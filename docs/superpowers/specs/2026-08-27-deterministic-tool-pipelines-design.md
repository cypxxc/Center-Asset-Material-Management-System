# Deterministic Tool Pipelines — Architecture & Design Spec

**Document Version:** 1.0.0  
**Date:** 2026-08-27  
**Status:** Approved  
**Author:** AI Cybersecurity & Infrastructure Defense Pair  

---

## 1. Executive Summary & Goals

### Problem Statement
In autonomous agentic workflows and tool-calling environments (e.g. MCP servers, LLM agents, internal automation scripts), LLMs frequently encounter tool invocation failures caused by:
1. **Schema ambiguity / Type coercion failures:** Stringified numbers, missing required nested fields, or unexpected enum values.
2. **Missing Pre-execution Guards:** Unauthorized calls, deactivated accounts, or rate-limit violations executing partially before failing.
3. **Non-deterministic tool outputs:** Handlers returning variable data structures, missing standard metadata, or throwing unformatted runtime exceptions.
4. **LLM Retry Hallucination Loops:** When an error occurs, standard stack traces or vague error messages cause agents to repeatedly retry invalid calls without understanding how to self-correct.

### Solution & Objectives
Implement a **Full-Spectrum Deterministic Tool Pipeline Framework** in CAMMS (`lib/tool-pipeline/`):
- **Deterministic Contracts:** Pure type-safe `defineTool<TInput, TOutput>()` interface with strict Zod v4 schemas for both input AND output.
- **6-Stage Pipeline Execution Lifecycle:** Input Validation -> Rate Limiting Guard -> RBAC/Auth Policy Check -> Sandboxed Handler Execution -> Strict Output Validation -> Observability/SIEM Telemetry.
- **Agent Self-Correction Feedback:** Predictable, machine-parsable error formats (`SCHEMA_VALIDATION_ERROR`, `RATE_LIMIT_ERROR`, `UNAUTHORIZED_ERROR`, `OUTPUT_MISMATCH_ERROR`, `EXECUTION_ERROR`) with automatic `remediationHint` generation.
- **Universal Adapters:** Native integration with Model Context Protocol (`scripts/mcp-server.ts`), Next.js Server Actions, and internal agent workflows.

---

## 2. System Architecture & Module Structure

```
lib/tool-pipeline/
├── types.ts           # Core types, interfaces, schemas, context definitions
├── errors.ts          # Deterministic ToolError hierarchy & Agent error formatter
├── pipeline.ts        # Core Pipeline Executor: runToolPipeline() and defineTool()
├── registry.ts        # In-memory Tool Registry with category/name indexing
├── adapters/
│   ├── mcp.ts         # Adapter transforming ToolDefinition into MCP JSON-RPC format
│   └── action.ts      # Adapter for wrapping tools into Next.js Server Actions
├── tools/             # Canonical CAMMS domain tools built on the pipeline
│   ├── items.ts       # getItem, listItems, createItem, updateItem, deleteItem
│   ├── categories.ts  # listCategories, createCategory
│   └── audit.ts       # queryAuditLogs, verifySystemSecurity
├── index.ts           # Public API re-exports
└── __tests__/
    ├── pipeline.test.ts
    ├── errors.test.ts
    ├── registry.test.ts
    └── mcp-adapter.test.ts
```

---

## 3. Detailed Component Specifications

### 3.1 Core Type Definitions (`lib/tool-pipeline/types.ts`)

```typescript
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

---

### 3.2 Deterministic Error Hierarchy & Self-Correction Hints (`lib/tool-pipeline/errors.ts`)

```typescript
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
```

#### Remediation Hint Strategies
- **Zod Issues**: Automatically iterates issues. If an issue is `invalid_type` on `expected: "number"`, hint states: `"Ensure field 'X' is a numerical value, not a string or object"`.
- **Enum Mismatch**: Lists valid enum options directly in the hint: `"Field 'item_type' must be one of: ['asset', 'supply']"`.
- **Permission Failure**: Informs the agent which role is required: `"Actor role 'viewer' cannot execute mutation tool 'delete_item'. Requires 'staff' or 'admin'"`.
- **Rate Limit Hit**: Instructs agent to pause: `"Rate limit breached. Please wait X seconds before retrying this tool"`.

---

### 3.3 Pipeline Execution Lifecycle (`lib/tool-pipeline/pipeline.ts`)

```typescript
export async function runToolPipeline<
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny
>(
  tool: ToolDefinition<TInputSchema, TOutputSchema>,
  rawInput: unknown,
  context: ToolExecutionContext
): Promise<ToolPipelineResult<z.infer<TOutputSchema>>>
```

**Step-by-step Enforcement:**
1. **Timer Start**: Record `startTime = performance.now()`.
2. **Stage 1 (Input Validation)**:
   - Call `tool.inputSchema.safeParse(rawInput)`.
   - If fail -> Map Zod issues to `fieldErrors` and generate `remediationHint`, return `SCHEMA_VALIDATION_ERROR`.
3. **Stage 2 (Rate Limiting Guard)**:
   - If `tool.rateLimitTier` is defined, call `checkRateLimit(tool.rateLimitTier, tool.name)`.
   - If fail -> Emit `RATE_LIMIT_EXCEEDED` SIEM event and return `RATE_LIMIT_EXCEEDED`.
4. **Stage 3 (Authorization Check)**:
   - If `tool.requiredRole` is `'admin'`, check `actor.role === 'admin'`.
   - If `tool.requiredRole` is `'staff'`, check `actor.role === 'admin' || actor.role === 'staff'`.
   - Verify `actor.isActive !== false`.
   - If fail -> Return `UNAUTHORIZED_ERROR`.
5. **Stage 4 (Sandboxed Execution & Timeout Guard)**:
   - Wrap `tool.handler(parsedInput, context)` with `Promise.race()` against `timeoutMs` (default: 30,000ms).
   - If timeout -> Return `TIMEOUT_ERROR`.
   - If unhandled exception thrown -> Catch, sanitize message, and return `TOOL_EXECUTION_ERROR`.
6. **Stage 5 (Strict Output Schema Enforcement)**:
   - Call `tool.outputSchema.safeParse(rawResult)`.
   - If fail -> Log `CRITICAL` alert: `"Tool output contract violation in '${tool.name}'"`. Return `OUTPUT_MISMATCH_ERROR` with detailed validation failures.
7. **Stage 6 (Telemetry & Audit)**:
   - Calculate `durationMs = Math.round(performance.now() - startTime)`.
   - Return `{ success: true, data: validatedOutput, durationMs }`.

---

### 3.4 Tool Registry (`lib/tool-pipeline/registry.ts`)

```typescript
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register<TIn extends z.ZodTypeAny, TOut extends z.ZodTypeAny>(
    tool: ToolDefinition<TIn, TOut>
  ): void

  get(name: string): ToolDefinition | undefined

  getAll(): ToolDefinition[]

  getByCategory(category: ToolDefinition['category']): ToolDefinition[]

  async execute(
    name: string,
    rawInput: unknown,
    context: ToolExecutionContext
  ): Promise<ToolPipelineResult<unknown>>
}
```

---

### 3.5 MCP Server Adapter (`lib/tool-pipeline/adapters/mcp.ts`)

Converts `ToolDefinition` to standard JSON-RPC MCP format:
- Translates Zod schema into JSON Schema for `tools/list`.
- Maps MCP `tools/call` requests into `runToolPipeline()`.
- Formats MCP response `content` array with structured text / JSON payload and `isError: boolean`.

---

## 4. Canonical Domain Tools

1. **`items_get`**: Fetch item by UUID or Asset Code (strict UUID / slug schema).
2. **`items_list`**: Search items with pagination, category filter, Thai search, status filter.
3. **`items_create`**: Create new item with strict name, type, price, quantity bounds.
4. **`items_update`**: Update item attributes with field-level schema validation.
5. **`items_delete`**: Archive / soft-delete item with required staff/admin role.
6. **`system_verify_security`**: Execute security audit checks programmatically.

---

## 5. Testing & Quality Assurance Plan

1. **Unit Tests (`lib/tool-pipeline/__tests__/`)**:
   - `pipeline.test.ts`: Test valid execution, input schema failures, output schema mismatches, timeouts, rate limit throttling, and unauthorized access.
   - `errors.test.ts`: Verify remediation hint generator for missing fields, bad enums, and type mismatches.
   - `registry.test.ts`: Tool registration, duplicates, category queries, and direct execution.
   - `mcp-adapter.test.ts`: JSON Schema translation and MCP tool execution.
2. **Verification Commands**:
   - `npm test` -> All unit and integration tests pass.
   - `npm run audit:security` -> All 5 security pillars pass.
   - `npm run typecheck` -> 0 TypeScript errors.
   - `npm run lint` -> 0 ESLint errors.

---

## 6. Security & Defense-in-Depth Alignment

- **Pillar 1**: Multi-tier rate limiting per tool category.
- **Pillar 2**: Zero trust execution context with actor validation.
- **Pillar 3**: Bidirectional Zod schema enforcement and path traversal / injection sanitization.
- **Pillar 4**: Dual client isolation when executing Supabase queries within handlers.
- **Pillar 5**: Structured SIEM telemetry and audit log tracking for all tool executions.
