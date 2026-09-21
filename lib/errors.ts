export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'UNEXPECTED'

export class ApplicationError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number
  readonly isOperational: boolean
  readonly details?: unknown

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    options?: { cause?: unknown; details?: unknown; isOperational?: boolean },
  ) {
    super(message, { cause: options?.cause })
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.isOperational = options?.isOperational ?? true
    this.details = options?.details
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = 'คุณไม่มีสิทธิ์ทำรายการนี้') {
    super(message, 'AUTHORIZATION_ERROR', 403)
  }
}

export function isApplicationError(err: unknown): err is ApplicationError {
  return err instanceof ApplicationError
}

/** Map typed errors to safe client-facing ActionResponse messages. */
export function toSafeErrorMessage(err: unknown): string {
  if (isApplicationError(err)) {
    return err.message
  }
  return 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล กรุณาลองใหม่อีกครั้ง'
}
