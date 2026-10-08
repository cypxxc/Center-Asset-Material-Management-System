import { runDiagnostics } from '../lib/self-healing/scanner'
import { healIssues } from '../lib/self-healing/healer'
import { DiagnosticDependencies } from '../lib/self-healing/types'

async function main() {
  const args = process.argv.slice(2)
  const isHelp = args.includes('--help') || args.includes('-h') || args.length === 0
  const isDiagnose = args.includes('--diagnose')
  const isHeal = args.includes('--heal')
  const isMock = args.includes('--mock')

  if (isHelp && !isDiagnose && !isHeal) {
    console.log(`
==================================================
CAMMS Self-Healing & System Reliability CLI
==================================================
Usage:
  npx tsx scripts/self-healing-job.ts [options]

Options:
  --diagnose    Scan system health and print diagnostic report
  --heal        Run diagnostics and automatically remediate safe issues
  --help, -h    Show this help message
`)
    process.exit(0)
  }

  const mockDeps: DiagnosticDependencies | undefined = isMock
    ? {
        fetchItems: async () => [
          { id: '1', item_name: 'Mock Item 1', asset_no: 'MOCK-01', serial_no: 'SN-01', category_id: null, location_id: null, quantity: 1 },
        ],
        fetchCategoryIds: async () => new Set(),
        fetchLocationIds: async () => new Set(),
        getCachedCount: async () => 1,
      }
    : undefined

  if (isDiagnose) {
    console.log('--- Scanning CAMMS System Health ---')
    const report = await runDiagnostics(mockDeps)
    console.log(`Timestamp: ${report.timestamp}`)
    console.log(`Health Score: ${report.healthScore}%`)
    console.log(`Total Issues: ${report.totalIssues}`)

    if (report.issues.length > 0) {
      console.log('\nDetected Issues:')
      report.issues.forEach((issue, idx) => {
        console.log(`  [${idx + 1}] [${issue.severity}] ${issue.code} - ${issue.title} (Auto-healable: ${issue.autoHealable})`)
      })
    } else {
      console.log('\n✅ All systems healthy. No issues detected.')
    }

    const hasCritical = report.issues.some((i) => i.severity === 'HIGH')
    process.exit(hasCritical ? 1 : 0)
  }

  if (isHeal) {
    console.log('--- Running Diagnostics & Self-Healing ---')
    const report = await runDiagnostics(mockDeps)
    console.log(`Initial Health Score: ${report.healthScore}% (${report.totalIssues} issues found)`)

    if (report.totalIssues === 0) {
      console.log('✅ Nothing to heal. All systems healthy.')
      console.log('Actions Completed: 0')
      process.exit(0)
    }

    const healDeps = isMock
      ? {
          revalidateCache: async () => {},
          quarantineOrphanItems: async () => 0,
          recordAudit: async () => 'mock-audit-id',
        }
      : undefined

    const results = await healIssues(report.issues, healDeps)
    console.log('\nRemediation Summary:')
    results.forEach((res, idx) => {
      console.log(`  [${idx + 1}] ${res.issueCode} -> ${res.status}: ${res.actionTaken} (Audit ID: ${res.auditId ?? 'N/A'})`)
    })
    console.log(`Actions Completed: ${results.filter((r) => r.status === 'SUCCESS').length}`)

    const hasFailedOrCritical = results.some((r) => r.status === 'FAILED')
    process.exit(hasFailedOrCritical ? 1 : 0)
  }
}

main().catch((err) => {
  console.error('Fatal self-healing runner error:', err)
  process.exit(1)
})
