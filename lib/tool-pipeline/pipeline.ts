import { z } from 'zod'
import {
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolPipelineResult,
} from './types'
import { ToolPipelineError, formatZodRemediationHint } from './errors'
import { logSecurityEvent } from '@/lib/security-logger'
import { checkRateLimit } from '@/lib/rate-limit'

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

    // 2. Stage 2: Rate Limiter Guard
    if (tool.rateLimitTier) {
      const rateLimitResult = await checkRateLimit(tool.name, tool.rateLimitTier)
      if (!rateLimitResult.success) {
        throw new ToolPipelineError({
          code: 'RATE_LIMIT_EXCEEDED',
          message: rateLimitResult.error || `Rate limit exceeded for tool '${tool.name}'`,
          remediationHint: 'Wait for the rate limit window to reset before retrying.',
        })
      }
    }

    // 3. Stage 3: RBAC & Identity Policy Check
    const actor = context.actor || {}
    if (actor.isActive === false) {
      logSecurityEvent({
        severity: 'MEDIUM',
        eventType: 'INACTIVE_ACCOUNT_ACCESS',
        threatVector: `Execution attempt on tool '${tool.name}' by inactive account`,
        impactAnalysis: 'Blocked execution attempt by deactivated account',
        automatedActionTaken: 'Rejected tool execution with UNAUTHORIZED_ERROR',
        recommendedFollowUp: `Verify status of user ID '${actor.id || 'unknown'}'`,
        actor: {
          userId: actor.id,
          role: actor.role,
          ip: actor.ip,
          userAgent: actor.userAgent,
        },
        metadata: {
          toolName: tool.name,
          category: tool.category,
          ...context.metadata,
        },
      })

      throw new ToolPipelineError({
        code: 'UNAUTHORIZED_ERROR',
        message: `Deactivated account cannot execute tool '${tool.name}'`,
        remediationHint: 'Contact administrator to re-activate account.',
      })
    }

    if (tool.requiredRole) {
      const role = actor.role
      if (tool.requiredRole === 'admin' && role !== 'admin') {
        logSecurityEvent({
          severity: 'LOW',
          eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          threatVector: `Insufficient privilege on tool '${tool.name}'`,
          impactAnalysis: `Caller with role '${role || 'anonymous'}' attempted to invoke admin-only tool`,
          automatedActionTaken: 'Rejected tool execution with UNAUTHORIZED_ERROR',
          recommendedFollowUp: 'Verify caller identity and assigned role permissions',
          actor: {
            userId: actor.id,
            role: actor.role,
            ip: actor.ip,
            userAgent: actor.userAgent,
          },
          metadata: {
            toolName: tool.name,
            requiredRole: tool.requiredRole,
            ...context.metadata,
          },
        })

        throw new ToolPipelineError({
          code: 'UNAUTHORIZED_ERROR',
          message: `Tool '${tool.name}' requires 'admin' role. Current role is '${role || 'anonymous'}'.`,
          remediationHint: 'Execute this tool under an account with admin privileges.',
        })
      } else if (tool.requiredRole === 'staff' && role !== 'admin' && role !== 'staff') {
        logSecurityEvent({
          severity: 'LOW',
          eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          threatVector: `Insufficient privilege on tool '${tool.name}'`,
          impactAnalysis: `Caller with role '${role || 'anonymous'}' attempted to invoke staff tool`,
          automatedActionTaken: 'Rejected tool execution with UNAUTHORIZED_ERROR',
          recommendedFollowUp: 'Verify caller identity and assigned role permissions',
          actor: {
            userId: actor.id,
            role: actor.role,
            ip: actor.ip,
            userAgent: actor.userAgent,
          },
          metadata: {
            toolName: tool.name,
            requiredRole: tool.requiredRole,
            ...context.metadata,
          },
        })

        throw new ToolPipelineError({
          code: 'UNAUTHORIZED_ERROR',
          message: `Tool '${tool.name}' requires 'staff' or 'admin' role. Current role is '${role || 'anonymous'}'.`,
          remediationHint: 'Execute this tool under an account with staff/admin privileges.',
        })
      } else if (tool.requiredRole === 'viewer' && role !== 'admin' && role !== 'staff' && role !== 'viewer') {
        throw new ToolPipelineError({
          code: 'UNAUTHORIZED_ERROR',
          message: `Tool '${tool.name}' requires authenticated role. Current role is '${role || 'anonymous'}'.`,
          remediationHint: 'Execute this tool under an authenticated account.',
        })
      }
    }

    // 4. Stage 4: Sandboxed Execution & Timeout Guard
    const timeoutMs = tool.timeoutMs || 30000
    let timeoutId: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new ToolPipelineError({
            code: 'TIMEOUT_ERROR',
            message: `Tool execution exceeded timeout of ${timeoutMs}ms`,
            remediationHint: 'Try reducing batch size or query complexity.',
          })
        )
      }, timeoutMs)
      if (typeof timeoutId.unref === 'function') {
        timeoutId.unref()
      }
    })

    let rawResult: unknown
    try {
      const executionPromise = tool.handler(parsedInput.data, context)
      rawResult = await Promise.race([executionPromise, timeoutPromise])
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }

    // 5. Stage 5: Strict Output Schema Enforcement
    const validatedOutput = tool.outputSchema.safeParse(rawResult)
    if (!validatedOutput.success) {
      logSecurityEvent({
        severity: 'HIGH',
        eventType: 'ADMIN_ACTION',
        threatVector: `Tool output contract violation in '${tool.name}'`,
        impactAnalysis: 'Tool produced response that violated declared output schema',
        automatedActionTaken: 'Blocked invalid output payload from reaching agent',
        recommendedFollowUp: 'Inspect tool handler implementation and output schema',
        actor: {
          userId: actor.id,
          role: actor.role,
          ip: actor.ip,
          userAgent: actor.userAgent,
        },
        metadata: {
          toolName: tool.name,
          category: tool.category,
          ...context.metadata,
        },
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
