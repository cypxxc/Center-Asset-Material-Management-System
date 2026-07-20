import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

// Performance Budgets (in bytes)
const BUDGETS = {
  shared_runtime_raw_max: 450 * 1024,
  shared_runtime_gzip_max: 150 * 1024,
  dashboard_route_raw_max: 160 * 1024,
  dashboard_route_gzip_max: 50 * 1024,
}

interface BuildManifest {
  rootMainFiles?: string[]
  polyfillFiles?: string[]
  pages?: Record<string, string[]>
}

const buildDir = path.resolve(process.cwd(), '.next')
const buildStaticDir = path.join(buildDir, 'static')
const buildManifestPath = path.join(buildDir, 'build-manifest.json')
const dashboardManifestPath = path.join(
  buildDir,
  'server',
  'app',
  '(dashboard)',
  'dashboard',
  'page_client-reference-manifest.js',
)
const dashboardManifestKey = '/(dashboard)/dashboard/page'

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

function readBuildFile(relativeFilePath: string): Buffer {
  const filePath = path.join(buildDir, relativeFilePath)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Build asset is missing: ${relativeFilePath}`)
  }
  return fs.readFileSync(filePath)
}

function getFileSize(relativeFilePath: string): number {
  return readBuildFile(relativeFilePath).length
}

function getGzipFileSize(relativeFilePath: string): number {
  return gzipSync(readBuildFile(relativeFilePath)).length
}

function readDashboardEntryFiles(): string[] {
  if (!fs.existsSync(dashboardManifestPath)) {
    throw new Error(`Dashboard client reference manifest is missing: ${dashboardManifestPath}`)
  }

  const source = fs.readFileSync(dashboardManifestPath, 'utf8')
  const assignment = `globalThis.__RSC_MANIFEST[${JSON.stringify(dashboardManifestKey)}] = `
  const assignmentStart = source.indexOf(assignment)
  if (assignmentStart < 0) {
    throw new Error(`Dashboard manifest assignment is malformed for ${dashboardManifestKey}`)
  }

  const jsonStart = assignmentStart + assignment.length
  const jsonEnd = source.indexOf(';', jsonStart)
  if (jsonEnd < 0) throw new Error('Dashboard manifest JSON is malformed')

  let manifest: unknown
  try {
    manifest = JSON.parse(source.slice(jsonStart, jsonEnd))
  } catch (error) {
    throw new Error('Dashboard manifest JSON is malformed', { cause: error })
  }

  const entryJSFiles = (manifest as { entryJSFiles?: unknown }).entryJSFiles
  if (!entryJSFiles || typeof entryJSFiles !== 'object' || Array.isArray(entryJSFiles)) {
    throw new Error('Dashboard manifest entryJSFiles is missing or malformed')
  }

  const files = Object.values(entryJSFiles).flatMap((value) => {
    if (!Array.isArray(value) || value.some((file) => typeof file !== 'string')) {
      throw new Error('Dashboard manifest entryJSFiles is missing or malformed')
    }
    return value as string[]
  })
  if (files.length === 0) throw new Error('Dashboard manifest entryJSFiles is empty')
  return [...new Set(files)]
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
const sharedRuntimeRawSize = [...initialFiles].reduce((total, file) => total + getFileSize(file), 0)
const sharedRuntimeGzipSize = [...initialFiles].reduce((total, file) => total + getGzipFileSize(file), 0)
const dashboardEntryFiles = readDashboardEntryFiles()
const dashboardRouteRawSize = dashboardEntryFiles.reduce((total, file) => total + getFileSize(file), 0)
const dashboardRouteGzipSize = dashboardEntryFiles.reduce((total, file) => total + getGzipFileSize(file), 0)
const polyfillFiles = new Set(buildManifest.polyfillFiles ?? [])
const polyfillJsSize = [...polyfillFiles].reduce((total, file) => total + getFileSize(file), 0)
const budgetedFiles = new Set([...initialFiles, ...polyfillFiles].map(resolveBuildFile))
const deferredJsSize = getDirectorySize(chunksDir, budgetedFiles)

console.log(`[CAMMS-BUDGET] Shared runtime JS (raw): ${formatKb(sharedRuntimeRawSize)} / ${formatKb(BUDGETS.shared_runtime_raw_max)}`)
console.log(`[CAMMS-BUDGET] Shared runtime JS (gzip transfer): ${formatKb(sharedRuntimeGzipSize)} / ${formatKb(BUDGETS.shared_runtime_gzip_max)}`)
console.log(`[CAMMS-BUDGET] Dashboard route JS (raw): ${formatKb(dashboardRouteRawSize)} / ${formatKb(BUDGETS.dashboard_route_raw_max)}`)
console.log(`[CAMMS-BUDGET] Dashboard route JS (gzip transfer): ${formatKb(dashboardRouteGzipSize)} / ${formatKb(BUDGETS.dashboard_route_gzip_max)}`)
console.log(`[CAMMS-BUDGET] Polyfill JS: ${formatKb(polyfillJsSize)} (reported separately; loaded only when needed by the browser)`)
console.log(`[CAMMS-BUDGET] Deferred/on-demand JS: ${formatKb(deferredJsSize)} (route and dynamic-import chunks)`)

const checks = [
  ['Shared runtime JS raw', sharedRuntimeRawSize, BUDGETS.shared_runtime_raw_max],
  ['Shared runtime JS gzip transfer', sharedRuntimeGzipSize, BUDGETS.shared_runtime_gzip_max],
  ['Dashboard route JS raw', dashboardRouteRawSize, BUDGETS.dashboard_route_raw_max],
  ['Dashboard route JS gzip transfer', dashboardRouteGzipSize, BUDGETS.dashboard_route_gzip_max],
] as const

for (const [label, actual, maximum] of checks) {
  if (actual > maximum) {
    console.error(`[CAMMS-ERROR] ${label} exceeds the budget of ${formatKb(maximum)}`)
    process.exitCode = 1
  }
}

if (!process.exitCode) {
  console.log('[CAMMS-BUDGET] Performance budget check passed. All raw and gzip limits are within budget.')
}
