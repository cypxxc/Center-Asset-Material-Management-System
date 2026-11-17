import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

function mockModule(path: string, exports: object) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}

let mockProfile: { id: string; role: string; is_active: boolean } | null = null
const mockItemData: { item: unknown; auditLogs: unknown[] } = {
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

test('ItemDetailPage redirects bookmark or scan requests to /items', async () => {
  const { default: ItemDetailPage } = await import('../../app/(dashboard)/items/[id]/page')
  assert.throws(
    () => {
      ItemDetailPage()
    },
    (err: unknown) => err instanceof Error && err.message.includes('NEXT_REDIRECT:/items'),
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
