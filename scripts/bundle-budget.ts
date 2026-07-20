import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

export const DEFAULT_BUDGETS = {
  shared_runtime_raw_max: 450 * 1024,
  shared_runtime_gzip_max: 150 * 1024,
  dashboard_route_raw_max: 160 * 1024,
  dashboard_route_gzip_max: 50 * 1024,
} as const

export type BudgetKey = keyof typeof DEFAULT_BUDGETS
export type BundleBudgets = Record<BudgetKey, number>

interface BuildManifest {
  rootMainFiles?: string[]
  polyfillFiles?: string[]
  pages?: Record<string, string[]>
}

export interface BundleAnalysis {
  dashboardEntryFiles: string[]
  polyfillFiles: string[]
  sharedRuntimeFiles: string[]
  sizes: Record<BudgetKey, number>
  violations: Array<{ key: BudgetKey; actual: number; maximum: number }>
}

const dashboardManifestKey = '/(dashboard)/dashboard/page'
const dashboardManifestRelativePath = path.join(
  'server',
  'app',
  '(dashboard)',
  'dashboard',
  'page_client-reference-manifest.js',
)

function extractAssignedJson(source: string, assignment: string): string {
  const assignmentStart = source.indexOf(assignment)
  if (assignmentStart < 0) throw new Error('Dashboard manifest assignment is malformed')
  let jsonStart = assignmentStart + assignment.length
  while (/\s/.test(source[jsonStart] ?? '')) jsonStart += 1
  if (source[jsonStart] !== '{') throw new Error('Dashboard manifest JSON is malformed')

  let depth = 0
  let inString = false
  let escaped = false
  for (let index = jsonStart; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) {
        const suffix = source.slice(index + 1)
        if (!/^\s*;\s*$/.test(suffix)) throw new Error('Dashboard manifest JSON is malformed')
        return source.slice(jsonStart, index + 1)
      }
    }
  }
  throw new Error('Dashboard manifest JSON is malformed')
}

function readDashboardEntryFiles(buildDir: string): string[] {
  const manifestPath = path.join(buildDir, dashboardManifestRelativePath)
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Dashboard client reference manifest is missing: ${manifestPath}`)
  }
  const source = fs.readFileSync(manifestPath, 'utf8')
  const assignment = `globalThis.__RSC_MANIFEST[${JSON.stringify(dashboardManifestKey)}] = `

  let manifest: unknown
  try {
    manifest = JSON.parse(extractAssignedJson(source, assignment))
  } catch (error) {
    if (error instanceof Error && /assignment|JSON/.test(error.message)) throw error
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
  if (files.length === 0) throw new Error('Dashboard manifest entryJSFiles is missing or malformed')
  return [...new Set(files)]
}

export function analyzeBundle(
  buildDir: string,
  budgets: BundleBudgets = DEFAULT_BUDGETS,
): BundleAnalysis {
  const staticDir = path.join(buildDir, 'static')
  if (!fs.existsSync(staticDir)) throw new Error(`Production build assets are missing: ${staticDir}`)

  const buildManifestPath = path.join(buildDir, 'build-manifest.json')
  if (!fs.existsSync(buildManifestPath)) throw new Error(`Build manifest is missing: ${buildManifestPath}`)
  const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8')) as BuildManifest

  const readAsset = (relativePath: string) => {
    const assetPath = path.join(buildDir, relativePath)
    if (!fs.existsSync(assetPath)) throw new Error(`Build asset is missing: ${relativePath}`)
    return fs.readFileSync(assetPath)
  }
  const rawSize = (files: string[]) => files.reduce((total, file) => total + readAsset(file).length, 0)
  const gzipSize = (files: string[]) =>
    files.reduce((total, file) => total + gzipSync(readAsset(file)).length, 0)

  const sharedRuntimeFiles = [
    ...new Set([...(buildManifest.rootMainFiles ?? []), ...Object.values(buildManifest.pages ?? {}).flat()]),
  ]
  const dashboardEntryFiles = readDashboardEntryFiles(buildDir)
  const sizes = {
    shared_runtime_raw_max: rawSize(sharedRuntimeFiles),
    shared_runtime_gzip_max: gzipSize(sharedRuntimeFiles),
    dashboard_route_raw_max: rawSize(dashboardEntryFiles),
    dashboard_route_gzip_max: gzipSize(dashboardEntryFiles),
  }
  const violations = (Object.keys(budgets) as BudgetKey[])
    .filter((key) => sizes[key] > budgets[key])
    .map((key) => ({ key, actual: sizes[key], maximum: budgets[key] }))

  return {
    dashboardEntryFiles,
    polyfillFiles: [...new Set(buildManifest.polyfillFiles ?? [])],
    sharedRuntimeFiles,
    sizes,
    violations,
  }
}
