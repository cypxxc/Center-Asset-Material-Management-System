import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import type { Page } from '@playwright/test'
import type { UATScenario, ScenarioResult, AgentStepAction, DefectFinding } from './scenarios/types'
import { GeminiUATClient, type AgentDecision } from './gemini-client'
import { extractInteractiveElements, type InteractiveElement } from './dom-extractor'
import { normalizeForStorage } from '@/lib/unicode'

export function computeDOMHash(elements: InteractiveElement[]): string {
  const content = elements.map(e => `${e.tag}:${e.label}:${e.disabled ?? false}:${e.value ?? ''}`).join('|')
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function isStagnant(hashHistory: string[]): boolean {
  if (hashHistory.length < 3) return false
  const last = hashHistory[hashHistory.length - 1]
  const secondLast = hashHistory[hashHistory.length - 2]
  const thirdLast = hashHistory[hashHistory.length - 3]
  return last === secondLast && secondLast === thirdLast
}

export async function runScenario(
  page: Page,
  scenario: UATScenario,
  client: GeminiUATClient,
  outputDir: string
): Promise<ScenarioResult> {
  const startTime = Date.now()
  const maxSteps = scenario.maxSteps || 15
  const screenshotDir = join(outputDir, 'screenshots', scenario.id)
  mkdirSync(screenshotDir, { recursive: true })

  const steps: AgentStepAction[] = []
  const defects: DefectFinding[] = []
  const hashHistory: string[] = []
  const previousStepSummaries: Array<{ step: number; tool: string; result: string }> = []

  let isComplete = false
  let finalStatus: 'PASS' | 'FAIL' = 'FAIL'
  let finalSummary = 'Scenario ไม่เสร็จสิ้นภายในขีดจำกัดขั้นตอน'

  for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
    // 1. Snapshot DOM and Screenshot
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    const dom = await extractInteractiveElements(page)
    const currentHash = computeDOMHash(dom.elements)
    hashHistory.push(currentHash)

    const screenshotPath = join(screenshotDir, `step-${stepNumber}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {})

    // Check Stagnation
    if (isStagnant(hashHistory)) {
      const defect: DefectFinding = {
        severity: 'Major',
        title: 'หน้าจอติดขัด (Stagnant Screen State)',
        description: `หน้าจอไม่มีการเปลี่ยนแปลงสถานะติดต่อกัน 3 ขั้นตอนที่ URL: ${dom.url}`,
        screenshotPath,
      }
      defects.push(defect)
      finalStatus = 'FAIL'
      finalSummary = 'ระบบหยุดชะงักหรือไม่ตอบสนองต่อการสั่งการของ AI ติดต่อกัน 3 ขั้นตอน'
      break
    }

    // 2. Ask Gemini for next action
    let decision: AgentDecision
    try {
      decision = await client.decideNextAction({
        role: scenario.role,
        goal: scenario.goal,
        url: dom.url,
        stepNumber,
        maxSteps,
        compactDOM: dom.compactText,
        previousSteps: previousStepSummaries,
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      defects.push({
        severity: 'Major',
        title: 'การตัดสินใจของ AI ล้มเหลว',
        description: errMsg,
        screenshotPath,
      })
      finalStatus = 'FAIL'
      finalSummary = `AI ไม่สามารถเลือกคำสั่งได้: ${errMsg}`
      break
    }

    const currentStepAction: AgentStepAction = {
      stepNumber,
      thought: decision.thought,
      tool: decision.tool,
      args: decision.args,
      screenshotPath,
      timestamp: new Date().toISOString(),
    }
    steps.push(currentStepAction)

    // 3. Execute Decision Tool
    let actionResultSummary = 'ดำเนินการสำเร็จ'
    try {
      if (decision.tool === 'complete_goal') {
        const status = (decision.args.status as string) === 'PASS' ? 'PASS' : 'FAIL'
        finalStatus = status
        finalSummary = String(decision.args.summary || (status === 'PASS' ? 'เป้าหมายสำเร็จ' : 'เป้าหมายล้มเหลว'))

        if (Array.isArray(decision.args.defects)) {
          for (const d of decision.args.defects as DefectFinding[]) {
            if (d && d.title && d.severity) {
              defects.push({ ...d, screenshotPath })
            }
          }
        }
        isComplete = true
        break
      } else if (decision.tool === 'click_element') {
        const id = Number(decision.args.id)
        const element = dom.elements.find(e => e.id === id)
        if (!element) {
          actionResultSummary = `ไม่พบ element [#${id}]`
        } else {
          await page.locator(element.selector).first().click({ timeout: 5000 })
          actionResultSummary = `คลิก element [#${id}] (${element.label})`
        }
      } else if (decision.tool === 'fill_input') {
        const id = Number(decision.args.id)
        const rawValue = String(decision.args.value || '')
        const normalizedValue = normalizeForStorage(rawValue)
        const element = dom.elements.find(e => e.id === id)
        if (!element) {
          actionResultSummary = `ไม่พบ input [#${id}]`
        } else {
          const locator = page.locator(element.selector).first()
          await locator.fill(normalizedValue, { timeout: 5000 })
          actionResultSummary = `กรอกข้อมูล "${normalizedValue}" ใน [#${id}]`
        }
      } else if (decision.tool === 'select_option') {
        const id = Number(decision.args.id)
        const value = String(decision.args.value || '')
        const element = dom.elements.find(e => e.id === id)
        if (!element) {
          actionResultSummary = `ไม่พบ select [#${id}]`
        } else {
          await page.locator(element.selector).first().selectOption(value, { timeout: 5000 })
          actionResultSummary = `เลือกตัวเลือก "${value}" ใน [#${id}]`
        }
      } else if (decision.tool === 'navigate_to') {
        const targetPath = String(decision.args.path || '/')
        await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: 15000 })
        actionResultSummary = `เดินทางไปยัง ${targetPath}`
      } else if (decision.tool === 'assert_condition') {
        const passed = Boolean(decision.args.passed)
        const assertion = String(decision.args.assertion || '')
        const observation = String(decision.args.observation || '')
        if (!passed) {
          defects.push({
            severity: 'Minor',
            title: `Assertion Failed: ${assertion}`,
            description: observation,
            screenshotPath,
          })
        }
        actionResultSummary = `ตรวจสอบ: "${assertion}" -> ${passed ? 'PASS' : 'FAIL'} (${observation})`
      }
    } catch (execErr) {
      const errMsg = execErr instanceof Error ? execErr.message : String(execErr)
      actionResultSummary = `เกิดข้อผิดพลาดขณะรันคำสั่ง ${decision.tool}: ${errMsg}`
    }

    previousStepSummaries.push({
      step: stepNumber,
      tool: decision.tool,
      result: actionResultSummary,
    })

    // Short stabilization pause
    await page.waitForTimeout(500)
  }

  const durationMs = Date.now() - startTime

  return {
    scenarioId: scenario.id,
    role: scenario.role,
    status: isComplete ? finalStatus : 'FAIL',
    durationMs,
    summary: finalSummary,
    steps,
    defects,
  }
}
