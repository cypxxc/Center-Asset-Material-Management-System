import test from 'node:test'
import assert from 'node:assert/strict'
import { generateMarkdownContent, buildHTMLReport, buildMarkdownSummary } from '../../scripts/ai-uat/reporter/report-builder'
import type { UATRunReport } from '../../scripts/ai-uat/scenarios/types'
import { existsSync, unlinkSync, mkdirSync } from 'node:fs'

const mockReport: UATRunReport = {
  timestamp: new Date().toISOString(),
  totalDurationMs: 8500,
  model: 'gemini-2.5-flash',
  readinessScore: 100,
  results: [
    {
      scenarioId: 'TC-ADM-01',
      role: 'admin',
      status: 'PASS',
      durationMs: 4200,
      summary: 'Dashboard KPIs loaded successfully',
      steps: [
        {
          stepNumber: 1,
          thought: 'ตรวจสอบภาพรวม',
          tool: 'assert_condition',
          args: { assertion: 'KPI visible' },
          timestamp: new Date().toISOString(),
        },
      ],
      defects: [],
    },
    {
      scenarioId: 'TC-STF-02',
      role: 'staff',
      status: 'PASS',
      durationMs: 4300,
      summary: 'RBAC boundary enforced properly',
      steps: [],
      defects: [],
    },
  ],
}

test('generateMarkdownContent generates table with pass rate', () => {
  const md = generateMarkdownContent(mockReport)
  assert.match(md, /100%/)
  assert.match(md, /TC-ADM-01/)
  assert.match(md, /TC-STF-02/)
  assert.match(md, /gemini-2.5-flash/)
})

test('buildHTMLReport writes self-contained html file with content', async () => {
  const testDir = 'test-results/uat/test-out'
  mkdirSync(testDir, { recursive: true })
  const htmlPath = `${testDir}/test-report.html`

  await buildHTMLReport(mockReport, htmlPath)
  assert.ok(existsSync(htmlPath))
  unlinkSync(htmlPath)
})

test('buildMarkdownSummary writes summary markdown file', async () => {
  const testDir = 'test-results/uat/test-out'
  mkdirSync(testDir, { recursive: true })
  const mdPath = `${testDir}/test-summary.md`

  await buildMarkdownSummary(mockReport, mdPath)
  assert.ok(existsSync(mdPath))
  unlinkSync(mdPath)
})
