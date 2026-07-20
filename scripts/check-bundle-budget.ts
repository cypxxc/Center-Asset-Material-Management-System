import fs from 'node:fs'
import path from 'node:path'
import { analyzeBundle, DEFAULT_BUDGETS, type BudgetKey } from './bundle-budget'

const buildDir = path.resolve(process.cwd(), '.next')

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`
}

const labels: Record<BudgetKey, string> = {
  shared_runtime_raw_max: 'Shared runtime JS (raw)',
  shared_runtime_gzip_max: 'Shared runtime JS (gzip transfer)',
  dashboard_route_raw_max: 'Dashboard route JS (raw)',
  dashboard_route_gzip_max: 'Dashboard route JS (gzip transfer)',
}

try {
  const analysis = analyzeBundle(buildDir)
  for (const key of Object.keys(DEFAULT_BUDGETS) as BudgetKey[]) {
    console.log(
      `[CAMMS-BUDGET] ${labels[key]}: ${formatKb(analysis.sizes[key])} / ${formatKb(DEFAULT_BUDGETS[key])}`,
    )
  }

  const polyfillSize = analysis.polyfillFiles.reduce((total, file) => {
    const assetPath = path.join(buildDir, file)
    if (!fs.existsSync(assetPath)) throw new Error(`Build asset is missing: ${file}`)
    return total + fs.statSync(assetPath).size
  }, 0)
  console.log(
    `[CAMMS-BUDGET] Polyfill JS: ${formatKb(polyfillSize)} (reported separately; loaded only when needed by the browser)`,
  )

  for (const violation of analysis.violations) {
    console.error(
      `[CAMMS-ERROR] ${labels[violation.key]} exceeds the budget of ${formatKb(violation.maximum)}`,
    )
  }
  if (analysis.violations.length > 0) process.exitCode = 1
  else console.log('[CAMMS-BUDGET] Performance budget check passed. All raw and gzip limits are within budget.')
} catch (error) {
  console.error(`[CAMMS-ERROR] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
