import fs from 'node:fs'
import path from 'node:path'

// Performance Budgets (in bytes)
const BUDGETS = {
  initial_root_js_max: 450 * 1024, // 450 KB
}

interface BuildManifest {
  rootMainFiles?: string[]
  polyfillFiles?: string[]
  pages?: Record<string, string[]>
}

const buildDir = path.resolve(process.cwd(), '.next')
const buildStaticDir = path.join(buildDir, 'static')
const buildManifestPath = path.join(buildDir, 'build-manifest.json')

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`
}

function getDirectorySize(dir: string, excludeFiles = new Set<string>()): number {
  let size = 0
  if (!fs.existsSync(dir)) return size

  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      size += getDirectorySize(filePath, excludeFiles)
    } else if (file.endsWith('.js') && !excludeFiles.has(path.normalize(filePath))) {
      size += stat.size
    }
  }
  return size
}

function readBuildManifest(): BuildManifest | null {
  if (!fs.existsSync(buildManifestPath)) return null

  return JSON.parse(fs.readFileSync(buildManifestPath, 'utf8')) as BuildManifest
}

function getFileSize(relativeFilePath: string): number {
  const filePath = path.join(buildDir, relativeFilePath)
  if (!fs.existsSync(filePath)) return 0

  return fs.statSync(filePath).size
}

function resolveBuildFile(relativeFilePath: string): string {
  return path.normalize(path.join(buildDir, relativeFilePath))
}

if (!fs.existsSync(buildStaticDir)) {
  console.log('[CAMMS-BUDGET] No production build assets found. Please compile the project first.')
  process.exit(0)
}

const buildManifest = readBuildManifest()
if (!buildManifest) {
  console.log('[CAMMS-BUDGET] No build manifest found. Please compile the project first.')
  process.exit(0)
}

const chunksDir = path.join(buildStaticDir, 'chunks')
const initialRootFiles = new Set(buildManifest.rootMainFiles ?? [])
const pageFiles = new Set(Object.values(buildManifest.pages ?? {}).flat())
const initialFiles = new Set([...initialRootFiles, ...pageFiles])
const initialJsSize = [...initialFiles].reduce((total, file) => total + getFileSize(file), 0)
const polyfillFiles = new Set(buildManifest.polyfillFiles ?? [])
const polyfillJsSize = [...polyfillFiles].reduce((total, file) => total + getFileSize(file), 0)
const budgetedFiles = new Set([...initialFiles, ...polyfillFiles].map(resolveBuildFile))
const deferredJsSize = getDirectorySize(chunksDir, budgetedFiles)

console.log(`[CAMMS-BUDGET] Initial root JS: ${formatKb(initialJsSize)} / ${formatKb(BUDGETS.initial_root_js_max)}`)
console.log(`[CAMMS-BUDGET] Polyfill JS: ${formatKb(polyfillJsSize)} (reported separately; loaded only when needed by the browser)`)
console.log(`[CAMMS-BUDGET] Deferred/on-demand JS: ${formatKb(deferredJsSize)} (route and dynamic-import chunks)`)

if (initialJsSize > BUDGETS.initial_root_js_max) {
  console.warn(`[CAMMS-WARN] [BUDGET-ALERT] Initial root JS exceeds the performance budget limit of ${formatKb(BUDGETS.initial_root_js_max)}`)
} else {
  console.log('[CAMMS-BUDGET] Performance budget check passed. Initial root JS within budget limit.')
}
