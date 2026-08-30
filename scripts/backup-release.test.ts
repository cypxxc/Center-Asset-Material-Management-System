import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { transpileModule, ModuleKind } from 'typescript'

type Entry = { name: string; id: string | null }
const loadModule = createRequire(path.join(process.cwd(), 'package.json'))

// Run the real CLI with only network/filesystem boundaries replaced. No live data is read or written.
async function runBackup(pages: Record<string, Entry[]>, failPrefix?: string) {
  const files = new Map<string, Buffer | string>()
  const directories = new Set<string>()
  const calls: Array<{ prefix: string; offset: number }> = []
  const source = transpileModule(readFileSync(path.join(process.cwd(), 'scripts/backup-release.ts'), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  let finish!: () => void
  const done = new Promise<void>((resolve) => { finish = resolve })
  let error = ''
  const processStub = {
    argv: ['node', 'backup-release.ts', path.resolve('test-backup-output')],
    cwd: () => process.cwd(),
    env: { NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fake-key' },
    stdout: { write: () => finish() },
    stderr: { write: (message: string) => { error = message; finish() } },
    exitCode: 0,
  }
  const client = {
    from: () => ({ select: () => ({ range: async () => ({ data: [], error: null }) }) }),
    auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
    storage: { from: () => ({
      list: async (prefix: string, options: { limit: number; offset?: number; sortBy?: { column: string; order: string } }) => {
        calls.push({ prefix, offset: options.offset ?? 0 })
        if (prefix === failPrefix) return { data: null, error: { message: 'list failed' } }
        const entries = pages[prefix] ?? []
        return { data: entries.slice(options.offset ?? 0, (options.offset ?? 0) + options.limit), error: null }
      },
      download: async (name: string) => ({ data: new Blob([name]), error: null }),
    }) },
  }
  runInNewContext(source, {
    exports: {}, Buffer, URL, process: processStub,
    require: (id: string) => {
      if (id === '@next/env') return { loadEnvConfig: () => {} }
      if (id === '@supabase/supabase-js') return { createClient: () => client }
      if (id === 'node:fs/promises') return {
        mkdir: async (dir: string) => {
          for (let current = dir; !directories.has(current); current = path.dirname(current)) {
            directories.add(current)
            if (current === path.dirname(current)) break
          }
        },
        writeFile: async (file: string, data: Buffer | string) => {
          assert.ok(directories.has(path.dirname(file)), `missing parent directory: ${file}`)
          files.set(file, data)
        },
      }
      return loadModule(id)
    },
  })
  await done
  return { files, calls, error }
}

test('release backup includes storage pages beyond 1000 and nested files in its manifest', async () => {
  const root: Entry[] = Array.from({ length: 1001 }, (_, index) => ({ name: `${String(index).padStart(4, '0')}.webp`, id: `id-${index}` }))
  root.push({ name: 'photos', id: null })
  const result = await runBackup({
    '': root,
    photos: [{ name: 'chair.webp', id: 'chair' }, { name: 'nested', id: null }],
    'photos/nested': [{ name: 'desk.webp', id: 'desk' }],
  })
  assert.equal(result.error, '')
  const manifestFile = [...result.files].find(([file]) => path.basename(file) === 'manifest.json')
  assert.ok(manifestFile)
  const manifest = JSON.parse(String(manifestFile[1]))
  assert.equal(manifest.counts.storage_files, 1003)
  assert.ok(manifest.files.storage.some((file: { name: string }) => file.name === 'photos/nested/desk.webp'))
  assert.ok(result.calls.some((call) => call.prefix === '' && call.offset === 1000))
  assert.ok([...result.files.keys()].some((file) => file.endsWith(path.join('photos', 'nested', 'desk.webp'))))
})

test('release backup fails instead of publishing a complete manifest when a nested listing fails', async () => {
  const result = await runBackup({ '': [{ name: 'photos', id: null }] }, 'photos')
  assert.match(result.error, /list failed/)
  assert.equal([...result.files.keys()].some((file) => path.basename(file) === 'manifest.json'), false)
})

test('release backup rejects parent traversal without writing outside its storage directory', async () => {
  const result = await runBackup({ '': [{ name: '../outside.webp', id: 'unsafe' }] })
  assert.match(result.error, /Unsafe storage entry/)
  assert.equal([...result.files.keys()].some((file) => file.endsWith('outside.webp')), false)
  assert.equal([...result.files.keys()].some((file) => path.basename(file) === 'manifest.json'), false)
})

test('release backup handles an empty bucket', async () => {
  const result = await runBackup({})
  assert.equal(result.error, '')
  const manifest = [...result.files].find(([file]) => path.basename(file) === 'manifest.json')
  assert.ok(manifest)
  assert.equal(JSON.parse(String(manifest[1])).counts.storage_files, 0)
})
