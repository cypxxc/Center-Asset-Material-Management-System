// instrumentation.ts — boot-time observability hook (structured JSON, no raw console.log)
import { config } from '@/lib/config'

function bootLog(runtime: string): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    severity: 'info',
    operation: 'boot',
    feature: 'instrumentation',
    environment: config.env.nodeEnv,
    details: { runtime, version: config.app.version },
  })
  console.info(`[CAMMS-BOOT] ${line}`)
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    bootLog('nodejs')

    process.on('unhandledRejection', (reason) => {
      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        severity: 'error',
        operation: 'unhandledRejection',
        feature: 'instrumentation',
        details: { reason: reason instanceof Error ? reason.message : String(reason) },
      })
      console.error(`[CAMMS-ERROR] ${line}`)
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    bootLog('edge')
  }
}
