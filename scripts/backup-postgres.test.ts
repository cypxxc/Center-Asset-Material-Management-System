import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { storageInventory } from './backup-postgres'

test('private storage inventory records nested file bytes and detects corruption', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'camms-backup-test-'))
  try {
    await mkdir(path.join(root,'item-images','owner'),{recursive:true})
    const file = path.join(root,'item-images','owner','image.png')
    await writeFile(file,Buffer.from([0,1,255]))
    const inventory = await storageInventory(root)
    assert.deepEqual(inventory,[{name:'item-images/owner/image.png',bytes:3,sha256:createHash('sha256').update(Buffer.from([0,1,255])).digest('hex')}])
    await writeFile(file,Buffer.from([0,2,255]))
    assert.notDeepEqual(await storageInventory(root),inventory,'Same-size file corruption must change inventory')
  } finally {
    assert.equal(path.dirname(root),tmpdir())
    assert.ok(path.basename(root).startsWith('camms-backup-test-'))
    await rm(root,{recursive:true,force:true})
  }
})

test('empty private storage has a valid empty inventory',async () => {
  const root = await mkdtemp(path.join(tmpdir(),'camms-backup-test-'))
  try { assert.deepEqual(await storageInventory(root),[]) }
  finally {
    assert.equal(path.dirname(root),tmpdir())
    assert.ok(path.basename(root).startsWith('camms-backup-test-'))
    await rm(root,{recursive:true,force:true})
  }
})
