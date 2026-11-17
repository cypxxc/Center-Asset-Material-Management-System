interface QueueOptions {
  minIntervalMs?: number
  maxAttempts?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export class ProviderRequestQueue {
  private tail: Promise<unknown> = Promise.resolve()
  private nextStart = 0
  private interval: number
  private attempts: number
  private now: () => number
  private sleep: (ms: number) => Promise<void>

  constructor(options: QueueOptions = {}) {
    this.interval = options.minIntervalMs ?? 13000
    this.attempts = options.maxAttempts ?? 4
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  }

  run(request: () => Promise<Response>): Promise<Response> {
    const result = this.tail.then(() => this.execute(request))
    // One failed request must not poison the queue for subsequent scenarios.
    this.tail = result.catch(() => {})
    return result
  }

  private async execute(request: () => Promise<Response>): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.nextStart - this.now()
      if (wait > 0) await this.sleep(wait)
      this.nextStart = this.now() + this.interval
      let response: Response
      try { response = await request() }
      catch (error) {
        const transient = error instanceof Error && (error.name === 'AbortError' || /fetch failed/i.test(error.message))
        if (!transient || attempt + 1 >= this.attempts) throw error
        this.nextStart = Math.max(this.nextStart, this.now() + Math.min(5000 * 2 ** attempt, 60000))
        continue
      }
      if (![429,503].includes(response.status) || attempt + 1 >= this.attempts) return response
      const header = response.headers.get('Retry-After')
      let delay = header ? (/^\d+(\.\d+)?$/.test(header) ? Number(header) * 1000 : Date.parse(header) - this.now()) : 0
      if (!Number.isFinite(delay) || delay < 0) delay = 0
      try {
        const body = await response.clone().json() as { error?: { details?: { retryDelay?: string }[] } }
        for (const detail of body.error?.details ?? []) {
          if (detail.retryDelay && /^\d+(\.\d+)?s$/.test(detail.retryDelay)) delay = Math.max(delay, Number(detail.retryDelay.slice(0,-1)) * 1000)
        }
      } catch { /* Provider errors can be non-JSON; use bounded exponential backoff. */ }
      // Daily quota exhaustion is a blocked scenario, not an overnight retry loop.
      if (delay > 120000) return response
      this.nextStart = Math.max(this.nextStart, this.now() + (delay > 0 ? delay : Math.min(5000 * 2 ** attempt, 60000)))
    }
  }
}

// All Gemini clients in a run share the same queue, including retries.
export const geminiRequestQueue = new ProviderRequestQueue({
  minIntervalMs: Math.max(13000, Number(process.env.UAT_AI_MIN_INTERVAL_MS) || 13000),
})
