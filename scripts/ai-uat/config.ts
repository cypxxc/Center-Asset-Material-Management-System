import { readFileSync, existsSync } from 'node:fs'
import { parse } from 'dotenv'

export interface UATConfig {
  apiKey: string
  model: string
  baseUrl: string
  maxSteps: number
  timeoutMs: number
}

export function getUATConfig(): UATConfig {
  let envKey = process.env.GEMINI_API_KEY || ''

  if (!envKey && existsSync('.env.local')) {
    try {
      const parsed = parse(readFileSync('.env.local'))
      if (parsed.GEMINI_API_KEY) {
        envKey = parsed.GEMINI_API_KEY
      }
    } catch {
      // Ignore reading error
    }
  }

  const baseUrl = process.env.UAT_BASE_URL || 'http://localhost:3000'
  const model = process.env.UAT_GEMINI_MODEL || 'gemini-2.5-flash'
  const maxSteps = Number(process.env.UAT_MAX_STEPS) || 15
  const timeoutMs = Number(process.env.UAT_TIMEOUT_MS) || 45000

  return {
    apiKey: envKey,
    model,
    baseUrl,
    maxSteps,
    timeoutMs,
  }
}
