import fs from 'node:fs'
import path from 'node:path'

// Performance Budgets (in bytes)
const BUDGETS = {
  shared_chunks_max: 450 * 1024, // 450 KB
}

const buildStaticDir = path.resolve(process.cwd(), '.next', 'static')

function getDirectorySize(dir: string): number {
  let size = 0
  if (!fs.existsSync(dir)) return size

  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      size += getDirectorySize(filePath)
    } else if (file.endsWith('.js')) {
      size += stat.size
    }
  }
  return size
}

if (!fs.existsSync(buildStaticDir)) {
  console.log('[CAMMS-BUDGET] No production build assets found. Please compile the project first.')
  process.exit(0)
}

const chunksDir = path.join(buildStaticDir, 'chunks')
const chunksSize = getDirectorySize(chunksDir)

console.log(`[CAMMS-BUDGET] Static JS chunks size: ${(chunksSize / 1024).toFixed(2)} KB`)

if (chunksSize > BUDGETS.shared_chunks_max) {
  console.warn(`[CAMMS-WARN] [BUDGET-ALERT] Shared JS chunks size exceeds the performance budget limit of ${BUDGETS.shared_chunks_max / 1024} KB`)
} else {
  console.log('[CAMMS-BUDGET] Performance budget check passed. Shared chunks within budget limit.')
}
