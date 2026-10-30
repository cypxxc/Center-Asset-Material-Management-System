import test from 'node:test'
import assert from 'node:assert/strict'
import { USER_ROLES } from '../../scripts/ai-uat/scenarios/types'
import type { UATScenario, ScenarioResult, AgentStepAction, DefectFinding, UATRunReport } from '../../scripts/ai-uat/scenarios/types'

test('validates USER_ROLES constant', () => {
  assert.deepEqual(USER_ROLES, ['admin', 'staff', 'viewer'])
})

test('validates UATScenario contract', () => {
  const scenario: UATScenario = {
    id: 'TC-ADM-01',
    role: 'admin',
    title: 'Dashboard Overview',
    goal: 'Verify dashboard loads KPI cards',
    successCriteria: ['KPI cards visible', 'No error banner'],
    maxSteps: 15,
  }
  assert.equal(scenario.id, 'TC-ADM-01')
  assert.equal(scenario.role, 'admin')
  assert.equal(scenario.maxSteps, 15)
})

test('validates ScenarioResult and DefectFinding structure', () => {
  const defect: DefectFinding = {
    severity: 'Major',
    title: 'Button overlapped',
    description: 'Save button overlaps table row',
    screenshotPath: 'screenshots/defect-1.png',
  }
  const step: AgentStepAction = {
    stepNumber: 1,
    thought: 'คลิกปุ่มบันทึก',
    tool: 'click_element',
    args: { id: 1 },
    timestamp: new Date().toISOString(),
  }
  const result: ScenarioResult = {
    scenarioId: 'TC-ADM-01',
    role: 'admin',
    status: 'PASS',
    durationMs: 3500,
    summary: 'Dashboard verified successfully',
    steps: [step],
    defects: [defect],
  }
  assert.equal(result.status, 'PASS')
  assert.equal(result.defects.length, 1)
  assert.equal(result.steps.length, 1)
})
