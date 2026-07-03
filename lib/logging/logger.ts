import { LogPayload } from './types'
import { formatLog } from './formatter'

export const logger = {
  info: (payload: LogPayload) => {
    console.info('[CAMMS-INFO]', formatLog('INFO', payload))
  },
  warn: (payload: LogPayload) => {
    console.warn('[CAMMS-WARN]', formatLog('WARN', payload))
  },
  error: (payload: LogPayload, err?: unknown) => {
    console.error('[CAMMS-ERROR]', formatLog('ERROR', payload, err))
  },
  audit: (payload: LogPayload) => {
    console.log('[CAMMS-AUDIT]', formatLog('AUDIT', payload))
  },
  debug: (payload: LogPayload) => {
    const isDev = process.env.NODE_ENV !== 'production'
    const isDebugEnabled = process.env.LOG_LEVEL === 'debug'
    if (isDev || isDebugEnabled) {
      console.log('[CAMMS-DEBUG]', formatLog('DEBUG', payload))
    }
  },
}
