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

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, { details })
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message = 'คุณไม่มีสิทธิ์ทำรายการนี้') {
    super(message, 'AUTHORIZATION_ERROR', 403)
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = 'ไม่พบข้อมูลที่ร้องขอ') {
    super(message, 'NOT_FOUND', 404)
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, { details })
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message = 'คุณทำรายการเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่') {
    super(message, 'RATE_LIMIT', 429)
  }
}

export class UnexpectedError extends ApplicationError {
  constructor(message = 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล กรุณาลองใหม่อีกครั้ง', cause?: unknown) {
    super(message, 'UNEXPECTED', 500, { cause, isOperational: false })
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
