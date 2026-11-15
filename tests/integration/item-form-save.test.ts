import '../setup/dom'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const id = '11111111-1111-4111-8111-111111111111'
const oldImage = `/api/files/item-images/${id}/${id}.png`
const newImage = `/api/files/item-images/${id}/22222222-2222-4222-8222-222222222222.png`
let uploads = 0
let failSave = false
let committedImage: string | null = oldImage
let deleted: string[] = []
function mockModule(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}
mockModule('../../features/items/auth-guard', { requireEditor: async () => ({ profile: { id, role: 'admin', is_active: true } }) })
mockModule('../../features/items/postgres-actions', {
  getPostgresItemForUpdate: async () => ({ data: { image_url: oldImage } }),
  updatePostgresItem: async (_id: string, data: { image_url: string | null }) => {
    if (failSave) return { error: { message: 'save failed' } }
    committedImage = data.image_url
    return { error: null }
  },
})
mockModule('../../lib/postgres/storage', {
  uploadLocalItemImage: async () => { uploads++; return newImage },
  deleteLocalItemImage: async (url: string) => { deleted.push(url); return { success: true } },
})
mockModule('../../lib/audit', { writeAuditLog: async () => {} })
mockModule('../../features/items/queries', {})
mockModule('../../features/items/import-export-actions', {})
mockModule('../../features/items/qualification-mapping', {})
const actions = import('../../features/items/actions')

beforeEach(() => { uploads = 0; failSave = false; deleted = []; committedImage = oldImage })
function form() {
  const data = new FormData()
  for (const [key, value] of Object.entries({ item_name: 'โต๊ะ', item_type: 'asset', quantity: '1', status: 'active', category_id: '', unit_id: '', location_id: '', depreciation_enabled: 'false' })) data.set(key, value)
  data.set('image_file', new File(['image'], 'photo.png', { type: 'image/png' }))
  return data
}
test('invalid item fields do not upload an image', async () => {
  const data = form()
  data.set('item_name', '')
  const result = await (await actions).updateItem(id, null, data)
  assert.equal(result.success, false)
  assert.ok(result.fieldErrors?.item_name)
  assert.equal(uploads, 0)
  assert.equal(committedImage, oldImage)
})
test('failed persistence removes the new upload and preserves the existing image', async () => {
  failSave = true
  const result = await (await actions).updateItem(id, null, form())
  assert.equal(result.success, false)
  assert.equal(uploads, 1)
  assert.deepEqual(deleted, [newImage])
  assert.equal(committedImage, oldImage)
})
test('successful replacement persists the new image and cleans up only the old image', async () => {
  const result = await (await actions).updateItem(id, null, form())
  assert.equal(result.success, true)
  assert.equal(committedImage, newImage)
  assert.deepEqual(deleted, [oldImage])
})
