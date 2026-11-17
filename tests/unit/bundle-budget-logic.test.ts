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

function fixture(options: {
  buildManifest?: unknown
  dashboardManifest?: string
  omitAsset?: string
  assetContents?: Partial<Record<'a' | 'b', string>>
} = {}) {
  const buildDir = mkdtempSync(path.join(tmpdir(), 'camms-bundle-budget-'))
  mkdirSync(path.join(buildDir, 'static', 'chunks'), { recursive: true })
  mkdirSync(path.dirname(path.join(buildDir, dashboardManifestRelativePath)), { recursive: true })
  writeFileSync(
    path.join(buildDir, 'build-manifest.json'),
    JSON.stringify(
      options.buildManifest ?? {
        rootMainFiles: ['static/chunks/a.js'],
        pages: { '/_app': ['static/chunks/a.js'] },
      },
    ),
  )
  if (options.omitAsset !== 'a') writeFileSync(path.join(buildDir, 'static', 'chunks', 'a.js'), options.assetContents?.a ?? 'alpha')
  if (options.omitAsset !== 'b') writeFileSync(path.join(buildDir, 'static', 'chunks', 'b.js'), options.assetContents?.b ?? 'beta')
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
    writeFileSync(
      path.join(emptyDir, 'build-manifest.json'),
      JSON.stringify({ rootMainFiles: ['static/chunks/a.js'], pages: {} }),
    )
    assert.throws(() => analyzeBundle(emptyDir), /dashboard client reference manifest.*missing/i)
  } finally {
    rmSync(emptyDir, { recursive: true, force: true })
  }
})

test('analyzeBundle validates the shared build manifest structure', () => {
  for (const [manifest, message] of [
    [{}, /rootMainFiles.*array of strings/i],
    [{ rootMainFiles: 'a.js', pages: {} }, /rootMainFiles.*array of strings/i],
    [{ rootMainFiles: [], pages: null }, /pages.*non-null object/i],
    [{ rootMainFiles: [], pages: { '/_app': 'a.js' } }, /pages.*arrays of strings/i],
    [{ rootMainFiles: [], pages: {} }, /shared runtime file set.*non-empty/i],
  ] as const) {
    const item = fixture({ buildManifest: manifest })
    try {
      assert.throws(() => analyzeBundle(item.buildDir), message)
    } finally {
      item.cleanup()
    }
  }
})

test('analyzeBundle rejects a missing referenced shared runtime asset', () => {
  const item = fixture({ omitAsset: 'a' })
  try {
    assert.throws(() => analyzeBundle(item.buildDir), /Build asset is missing: static[\\/]chunks[\\/]a\.js/)
  } finally {
    item.cleanup()
  }
})

test('analyzeBundle proves the deferred guide is absent from initial dashboard entries', () => {
  const deferred = fixture({
    assetContents: { b: 'CAMMS User Guide' },
    dashboardManifest:
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"] = {"entryJSFiles":{"page":["static/chunks/a.js"]}};',
  })
  try {
    assert.doesNotThrow(() => analyzeBundle(deferred.buildDir))
  } finally {
    deferred.cleanup()
  }

  const initial = fixture({ assetContents: { a: 'CAMMS User Guide' } })
  try {
    assert.throws(() => analyzeBundle(initial.buildDir), /CAMMS User Guide.*initial dashboard/i)
  } finally {
    initial.cleanup()
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

  const invalidClientModules = fixture({
    dashboardManifest:
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"] = {"clientModules":[{"chunks":["100","static/chunks/a.js"]}]};',
  })
  try {
    assert.throws(() => analyzeBundle(invalidClientModules.buildDir), /clientModules.*malformed/i)
  } finally {
    invalidClientModules.cleanup()
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

test('analyzeBundle reads Webpack clientModules chunk paths without entryJSFiles', () => {
  const { buildDir, cleanup } = fixture({
    dashboardManifest:
      'globalThis.__RSC_MANIFEST["/(dashboard)/dashboard/page"]={"clientModules":{"dashboard":{"chunks":["100","static/chunks/a.js","200","static/chunks/b.js"]},"shared":{"chunks":["300","static/chunks/a.js"]}}};',
  })
  try {
    const result = analyzeBundle(buildDir)
    assert.deepEqual(result.dashboardEntryFiles, ['static/chunks/a.js', 'static/chunks/b.js'])
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
