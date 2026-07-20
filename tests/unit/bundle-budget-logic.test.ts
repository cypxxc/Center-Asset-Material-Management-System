import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  analyzeBundle,
  DEFAULT_BUDGETS,
  type BundleBudgets,
  type BudgetKey,
} from '../../scripts/bundle-budget'

const dashboardManifestRelativePath = path.join(
  'server',
  'app',
  '(dashboard)',
  'dashboard',
  'page_client-reference-manifest.js',
)

function fixture(options: { dashboardManifest?: string; omitAsset?: string } = {}) {
  const buildDir = mkdtempSync(path.join(tmpdir(), 'camms-bundle-budget-'))
  mkdirSync(path.join(buildDir, 'static', 'chunks'), { recursive: true })
  mkdirSync(path.dirname(path.join(buildDir, dashboardManifestRelativePath)), { recursive: true })
  writeFileSync(
    path.join(buildDir, 'build-manifest.json'),
    JSON.stringify({ rootMainFiles: ['static/chunks/a.js'], pages: { '/_app': ['static/chunks/a.js'] } }),
  )
  if (options.omitAsset !== 'a') writeFileSync(path.join(buildDir, 'static', 'chunks', 'a.js'), 'alpha')
  if (options.omitAsset !== 'b') writeFileSync(path.join(buildDir, 'static', 'chunks', 'b.js'), 'beta')
  writeFileSync(
    path.join(buildDir, dashboardManifestRelativePath),
    options.dashboardManifest ??
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"] = {"note":"semi;colon } brace","entryJSFiles":{"layout":["static/chunks/a.js","static/chunks/b.js"],"page":["static/chunks/a.js"]}};',
  )
  return { buildDir, cleanup: () => rmSync(buildDir, { recursive: true, force: true }) }
}

test('analyzeBundle rejects missing build prerequisites', () => {
  const emptyDir = mkdtempSync(path.join(tmpdir(), 'camms-bundle-budget-empty-'))
  try {
    assert.throws(() => analyzeBundle(emptyDir), /production build assets.*missing/i)
    mkdirSync(path.join(emptyDir, 'static'))
    assert.throws(() => analyzeBundle(emptyDir), /build manifest.*missing/i)
    writeFileSync(path.join(emptyDir, 'build-manifest.json'), '{}')
    assert.throws(() => analyzeBundle(emptyDir), /dashboard client reference manifest.*missing/i)
  } finally {
    rmSync(emptyDir, { recursive: true, force: true })
  }
})

test('analyzeBundle rejects malformed dashboard entryJSFiles and missing assets', () => {
  const missingEntries = fixture({
    dashboardManifest:
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"] = {"clientModules":{}};',
  })
  try {
    assert.throws(() => analyzeBundle(missingEntries.buildDir), /entryJSFiles.*malformed/i)
  } finally {
    missingEntries.cleanup()
  }

  const malformed = fixture({
    dashboardManifest:
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"] = {"entryJSFiles":"invalid"};',
  })
  try {
    assert.throws(() => analyzeBundle(malformed.buildDir), /entryJSFiles.*malformed/i)
  } finally {
    malformed.cleanup()
  }

  const missingAsset = fixture({ omitAsset: 'b' })
  try {
    assert.throws(() => analyzeBundle(missingAsset.buildDir), /Build asset is missing: static[\\/]chunks[\\/]b\.js/)
  } finally {
    missingAsset.cleanup()
  }
})

test('analyzeBundle scans assigned JSON strings safely and deduplicates dashboard files', () => {
  const { buildDir, cleanup } = fixture()
  try {
    const result = analyzeBundle(buildDir)
    assert.deepEqual(result.dashboardEntryFiles, ['static/chunks/a.js', 'static/chunks/b.js'])
    assert.equal(result.sizes.dashboard_route_raw_max, Buffer.byteLength('alpha') + Buffer.byteLength('beta'))
  } finally {
    cleanup()
  }
})

test('analyzeBundle rejects garbage around the assigned dashboard JSON object', () => {
  const prefixGarbage = fixture({
    dashboardManifest:
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"] = garbage {"entryJSFiles":{"page":["static/chunks/a.js"]}};',
  })
  try {
    assert.throws(() => analyzeBundle(prefixGarbage.buildDir), /manifest JSON.*malformed/i)
  } finally {
    prefixGarbage.cleanup()
  }

  const suffixGarbage = fixture({
    dashboardManifest:
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"] = {"entryJSFiles":{"page":["static/chunks/a.js"]}} garbage;',
  })
  try {
    assert.throws(() => analyzeBundle(suffixGarbage.buildDir), /manifest JSON.*malformed/i)
  } finally {
    suffixGarbage.cleanup()
  }

  const missingSemicolon = fixture({
    dashboardManifest:
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"] = {"entryJSFiles":{"page":["static/chunks/a.js"]}}',
  })
  try {
    assert.throws(() => analyzeBundle(missingSemicolon.buildDir), /manifest JSON.*malformed/i)
  } finally {
    missingSemicolon.cleanup()
  }
})

for (const budgetKey of Object.keys(DEFAULT_BUDGETS) as BudgetKey[]) {
  test(`analyzeBundle fails ${budgetKey} independently`, () => {
    const { buildDir, cleanup } = fixture()
    try {
      const budgets = Object.fromEntries(
        Object.keys(DEFAULT_BUDGETS).map((key) => [key, Number.MAX_SAFE_INTEGER]),
      ) as unknown as BundleBudgets
      budgets[budgetKey] = 0
      const result = analyzeBundle(buildDir, budgets)
      assert.deepEqual(result.violations.map((violation) => violation.key), [budgetKey])
    } finally {
      cleanup()
    }
  })
}
