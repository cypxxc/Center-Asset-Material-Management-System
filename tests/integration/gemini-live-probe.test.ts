import test from 'node:test'
import assert from 'node:assert/strict'
import { GeminiUATClient, getUATConfig } from '../../scripts/ai-uat/gemini-client'

test('Gemini API Live Connection and Function Calling', async () => {
  const config = getUATConfig()
  if (!config.apiKey) {
    console.log('Skipping live probe: No GEMINI_API_KEY')
    return
  }

  const client = new GeminiUATClient(config)
  try {
    const decision = await client.decideNextAction({
      role: 'admin',
      goal: 'เดินทางไปยังหน้าแดชบอร์ด',
      url: 'http://localhost:3000',
      stepNumber: 1,
      maxSteps: 10,
      compactDOM: 'URL: http://localhost:3000\n[#1] a[href="/dashboard"] "ภาพรวมพัสดุ"',
      previousSteps: [],
    })

    assert.ok(decision.tool)
    assert.ok(decision.thought)
    console.log('Gemini Live Decision:', decision)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('503') || message.includes('429') || message.includes('high demand') || message.includes('fetch failed')) {
      console.warn('Skipping live probe: Gemini API temporarily unavailable (503/429/network):', message)
      return
    }
    throw err
  }
})
