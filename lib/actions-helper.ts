export interface ActionResponse<T = unknown> {
  success?: boolean
  ok?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
  data?: T
}

export function successResponse<T>(message: string, data?: T): ActionResponse<T> {
  return {
    success: true,
    ok: true,
    message,
    data,
  }
}

export function errorResponse<T = unknown>(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResponse<T> {
  return {
    success: false,
    ok: false,
    message: error,
    error,
    fieldErrors,
  }
}
