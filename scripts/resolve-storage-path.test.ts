import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const startArgs = JSON.parse(readFileSync('package.json', 'utf8')).scripts.start.split(' ').slice(1) as string[]
for (const mode of ['relative', 'absolute', 'unset'] as const) {
  test(`production image storage remains stable after standalone chdir: ${mode}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'camms-storage-start-'))
    try {
      const standalone = join(root, '.next', 'standalone')
      mkdirSync(standalone, { recursive: true })
      const configured = mode === 'absolute' ? join(root, 'persistent-images') : './.local-storage'
      writeFileSync(join(root, '.env.local'), mode === 'unset' ? '' : `LOCAL_STORAGE_PATH=${JSON.stringify(configured)}\n`)
      const server = join(standalone, 'server.cjs')
      writeFileSync(server, `
        const fs = require('node:fs'), path = require('node:path');
        process.chdir(__dirname);
        const storage = path.resolve(process.env.LOCAL_STORAGE_PATH || './data/storage');
        fs.mkdirSync(storage, {recursive:true});
        fs.writeFileSync(path.join(storage,'image.png'), 'image-bytes');
        process.stdout.write(storage);
      `)
      const env = { ...process.env }
      delete env.LOCAL_STORAGE_PATH
      for (const arg of startArgs.filter(arg => arg.startsWith('./scripts/'))) {
        mkdirSync(join(root, 'scripts'), { recursive: true })
        copyFileSync(resolve(arg), join(root, arg))
      }
      const result = spawnSync(process.execPath, startArgs.map(arg => arg === '.next/standalone/server.js' ? server : arg), { cwd: root, env, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
      const expected = resolve(root, mode === 'unset' ? './data/storage' : configured)
      assert.equal(result.stdout, expected)
      assert.equal(readFileSync(join(expected, 'image.png'), 'utf8'), 'image-bytes')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
}
