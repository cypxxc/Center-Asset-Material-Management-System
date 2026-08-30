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
