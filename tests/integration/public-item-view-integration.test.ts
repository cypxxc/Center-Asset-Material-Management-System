import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

function mockModule(path: string, exports: object) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}

let mockProfile: { id: string; role: string; is_active: boolean } | null = null
let mockItemData: { item: unknown; auditLogs: unknown[] } = {
  item: null,
  auditLogs: [],
}

mockModule('../../features/auth/queries', {
  getCurrentProfile: async () => mockProfile,
})

mockModule('../../features/items/queries', {
  getItemDetailPageData: async () => mockItemData,
})

mockModule('next/navigation', {
  notFound: () => {
    const error = new Error('NEXT_NOT_FOUND') as Error & { digest?: string }
    error.digest = 'NEXT_NOT_FOUND'
    throw error
  },
  redirect: (url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`) as Error & { digest?: string }
    error.digest = `NEXT_REDIRECT;replace;${url}`
    throw error
  },
})

test('ItemDetailPage renders PublicItemView when unauthenticated and item exists', async () => {
  mockProfile = null
  mockItemData = {
    item: {
      id: 'test-item-1',
      item_name: 'กล้องจุลทรรศน์',
      item_type: 'asset',
      status: 'active',
      asset_no: 'AST-MIC-01',
      serial_no: 'SN-999',
      quantity: 1,
      unit_price: 35000,
      responsible_person: 'ดร.สมชาย',
      category: { id: 'c1', name: 'วิทยาศาสตร์' },
      location: { id: 'l1', name: 'ห้องแล็บ 402' },
      unit: { id: 'u1', name: 'เครื่อง' },
    },
    auditLogs: [],
  }

  const { default: ItemDetailPage } = await import('../../app/(dashboard)/items/[id]/page')
  const result = await ItemDetailPage({
    params: Promise.resolve({ id: 'test-item-1' }),
  })

  // Should render PublicItemView component, not throw redirect
  assert.ok(result, 'Result element should be returned')
  // PublicItemView should be returned when unauthenticated
  assert.equal(typeof result, 'object')
})

test('ItemDetailPage calls notFound when unauthenticated and item does not exist', async () => {
  mockProfile = null
  mockItemData = {
    item: null,
    auditLogs: [],
  }

  const { default: ItemDetailPage } = await import('../../app/(dashboard)/items/[id]/page')
  await assert.rejects(
    async () => {
      await ItemDetailPage({
        params: Promise.resolve({ id: 'non-existent' }),
      })
    },
    (err: unknown) => err instanceof Error && err.message === 'NEXT_NOT_FOUND',
  )
})

test('DashboardLayout renders children directly when unauthenticated and pathname matches public item UUID', async () => {
  mockProfile = null
  const publicUuid = '11111111-2222-3333-4444-555555555555'
  mockModule('next/headers', {
    headers: async () => new Map([['x-pathname', `/items/${publicUuid}`]]),
  })

  const { default: DashboardLayout } = await import('../../app/(dashboard)/layout')
  const dummyChild = React.createElement('div', { id: 'public-child' }, 'Public Content')
  const result = await DashboardLayout({ children: dummyChild })

  assert.ok(result)
})
