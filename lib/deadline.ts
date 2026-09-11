/** Bound the whole operation, including SDK retries, and cancel its HTTP requests. */
export async function withDeadline<T>(
  operation: () => PromiseLike<T>,
  timeoutMs: number,
  controller = new AbortController(),
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new DOMException('Service response timed out', 'TimeoutError')
          reject(error)
          controller.abort(error)
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
