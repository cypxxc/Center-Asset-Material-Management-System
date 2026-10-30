import test from 'node:test'
import assert from 'node:assert/strict'
import { UAT_TOOL_DECLARATIONS, formatSystemPrompt, getUATConfig, GeminiUATClient } from '../../scripts/ai-uat/gemini-client'

test('UAT_TOOL_DECLARATIONS exposes required testing tools', () => {
  const toolNames = UAT_TOOL_DECLARATIONS.map(t => t.name)
  assert.ok(toolNames.includes('click_element'))
  assert.ok(toolNames.includes('fill_input'))
  assert.ok(toolNames.includes('select_option'))
  assert.ok(toolNames.includes('navigate_to'))
  assert.ok(toolNames.includes('assert_condition'))
  assert.ok(toolNames.includes('complete_goal'))
})

test('formatSystemPrompt includes role and goal instructions', () => {
  const prompt = formatSystemPrompt('staff', 'เพิ่มพัสดุใหม่')
  assert.match(prompt, /staff/i)
  assert.match(prompt, /เพิ่มพัสดุใหม่/)
  assert.match(prompt, /CAMMS/)
})

test('getUATConfig parses environment settings with sensible defaults', () => {
  const config = getUATConfig()
  assert.ok(config.baseUrl)
  assert.equal(config.model, 'gemini-2.5-flash')
  assert.ok(config.maxSteps > 0)
})

test('GeminiUATClient throws error when API key is missing', () => {
  assert.throws(() => {
    new GeminiUATClient({ apiKey: '', model: 'gemini-2.5-flash', baseUrl: 'http://localhost:3000', maxSteps: 15, timeoutMs: 30000 })
  }, /GEMINI_API_KEY/)
})
