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
      const received =
        (issue as unknown as { received?: string }).received ??
        (issue.input !== undefined ? typeof issue.input : 'unknown')
      hints.push(`Field '${path}' expects type '${issue.expected}', received '${received}'.`)
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
