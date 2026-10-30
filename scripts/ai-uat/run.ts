import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { getUATConfig } from './config'
import { GeminiUATClient } from './gemini-client'
import { runScenario } from './agent-driver'
import { getAllScenarios, type UserRole, type UATScenario, type ScenarioResult, type UATRunReport } from './scenarios'
import { buildHTMLReport, buildMarkdownSummary } from './reporter/report-builder'

export interface CliArgs {
  headed: boolean
  role?: UserRole
  scenarioId?: string
}

export function parseCliArgs(argv: string[]): CliArgs {
  const headed = argv.includes('--headed')
  let role: UserRole | undefined = undefined
  let scenarioId: string | undefined = undefined

  const roleIdx = argv.indexOf('--role')
  if (roleIdx !== -1 && argv[roleIdx + 1]) {
    const val = argv[roleIdx + 1].toLowerCase()
    if (val === 'admin' || val === 'staff' || val === 'viewer') {
      role = val
    }
  }

  const scenarioIdx = argv.indexOf('--scenario')
  if (scenarioIdx !== -1 && argv[scenarioIdx + 1]) {
    scenarioId = argv[scenarioIdx + 1]
  }

  return { headed, role, scenarioId }
}

export async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const config = getUATConfig()

  if (!config.apiKey || !config.apiKey.trim()) {
    console.error('\n❌ [AI UAT Error] ไม่พบ GEMINI_API_KEY กรุณากำหนดค่าในไฟล์ .env.local หรือส่งผ่าน environment variable')
    console.error('ตัวอย่างใน .env.local: GEMINI_API_KEY=AQ.Ab8RN6K9...\n')
    process.exit(1)
  }

  let scenarios = getAllScenarios(args.role)
  if (args.scenarioId) {
    scenarios = scenarios.filter(s => s.id === args.scenarioId)
  }

  if (scenarios.length === 0) {
    console.log('⚠️ ไม่พบ Scenario ที่ตรงกับเงื่อนไขที่ระบุ')
    return
  }

  console.log(`\n🤖 เริ่มต้นการทดสอบ CAMMS AI Autonomous UAT (จำนวน: ${scenarios.length} Scenarios)`)
  console.log(`โมเดล: ${config.model} | URL: ${config.baseUrl} | โหมด: ${args.headed ? 'Headed (แสดงหน้าต่าง)' : 'Headless'}\n`)

  const client = new GeminiUATClient(config)
  const browser = await chromium.launch({ headless: !args.headed })
  const outputDir = join(process.cwd(), 'test-results', 'uat')
  mkdirSync(outputDir, { recursive: true })

  const results: ScenarioResult[] = []
  const startTime = Date.now()

  for (const scenario of scenarios) {
    console.log(`▶ กำลังรัน: [${scenario.id}] (${scenario.role.toUpperCase()}) ${scenario.title}`)

    const authFile = join(process.cwd(), 'tests', 'e2e', 'staging', '.auth', `${scenario.role}.json`)
    const contextOptions: Record<string, unknown> = {
      baseURL: config.baseUrl,
      viewport: { width: 1280, height: 720 },
    }
    if (existsSync(authFile)) {
      contextOptions.storageState = authFile
    }

    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()

    try {
      // Start at dashboard or items
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
      const result = await runScenario(page, scenario, client, outputDir)
      results.push(result)

      const statusIcon = result.status === 'PASS' ? '✅' : '❌'
      console.log(`  ${statusIcon} ${result.status}: ${result.summary} (${(result.durationMs / 1000).toFixed(2)}s)\n`)
    } catch (err) {
      console.error(`  ❌ เกิดข้อผิดพลาดขณะรัน Scenario:`, err)
      results.push({
        scenarioId: scenario.id,
        role: scenario.role,
        status: 'FAIL',
        durationMs: 0,
        summary: `เกิดข้อผิดพลาดรุนแรง: ${err instanceof Error ? err.message : String(err)}`,
        steps: [],
        defects: [
          {
            severity: 'Critical',
            title: 'Scenario Execution Exception',
            description: err instanceof Error ? err.stack || err.message : String(err),
          },
        ],
      })
    } finally {
      await context.close()
    }
  }

  await browser.close()

  const totalDurationMs = Date.now() - startTime
  const passed = results.filter(r => r.status === 'PASS').length
  const total = results.length
  const readinessScore = total > 0 ? Math.round((passed / total) * 100) : 0

  const report: UATRunReport = {
    timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
    totalDurationMs,
    model: config.model,
    results,
    readinessScore,
  }

  const htmlReportPath = join(outputDir, 'index.html')
  const mdReportPath = join(outputDir, 'SUMMARY.md')

  await buildHTMLReport(report, htmlReportPath)
  await buildMarkdownSummary(report, mdReportPath)

  console.log(`\n======================================================`)
  console.log(`📊 ผลการตรวจรับ UAT สิ้นสุด: ผ่าน ${passed}/${total} (${readinessScore}%)`)
  console.log(`📁 รายงานฉบับเต็ม (Interactive HTML): ${htmlReportPath}`)
  console.log(`📄 รายงานสรุป (Markdown): ${mdReportPath}`)
  console.log(`======================================================\n`)
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].includes('scripts/ai-uat/run.ts')) {
  main().catch(err => {
    console.error('Fatal CLI Error:', err)
    process.exit(1)
  })
}
