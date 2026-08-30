import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { createMockSupabaseClient, mockSupabaseRegistry } from '../mocks/supabase'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key'

const supabaseJsPath = require.resolve('@supabase/supabase-js')
require.cache[supabaseJsPath] = {
  id: supabaseJsPath,
  filename: supabaseJsPath,
  loaded: true,
  exports: {
    createClient: () => createMockSupabaseClient('service'),
  },
} as NodeJS.Module

const supabaseSsrPath = require.resolve('@supabase/ssr')
require.cache[supabaseSsrPath] = {
  id: supabaseSsrPath,
  filename: supabaseSsrPath,
  loaded: true,
  exports: {
    createServerClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    }),
  },
} as NodeJS.Module

test('middleware redirects anonymous item-detail requests to login', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  const request = new NextRequest('http://localhost:3000/items/item-1')

  const response = await updateSession(request)

  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'http://localhost:3000/login')
})

test('middleware does not treat a dotted protected path as a static asset', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  const request = new NextRequest('http://localhost:3000/items/restricted.asset.record')

  const response = await updateSession(request)

  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'http://localhost:3000/login')
})

test('proxy matcher sends a protected image-suffixed path through authentication', async () => {
  const [{ config, proxy }, { unstable_doesMiddlewareMatch }] = await Promise.all([
    import('../../proxy'),
    import('next/experimental/testing/server'),
  ])
  const url = 'http://localhost:3000/items/restricted.png'

  assert.equal(unstable_doesMiddlewareMatch({ config, url }), true)

  const response = await proxy(new NextRequest(url))
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'http://localhost:3000/login')
})

test('proxy matcher preserves framework exclusions and delegates explicit public assets', async () => {
  const [{ config, proxy }, { unstable_doesMiddlewareMatch }] = await Promise.all([
    import('../../proxy'),
    import('next/experimental/testing/server'),
  ])
  const frameworkManagedUrls = [
    'http://localhost:3000/_next/static/chunks/app.js',
    'http://localhost:3000/_next/image?url=%2Fimages%2Flogo.png&w=640&q=75',
    'http://localhost:3000/favicon.ico',
  ]

  for (const url of frameworkManagedUrls) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url }), false, url)
  }

  const explicitlyPublicAssetUrls = [
    'http://localhost:3000/assets/app.js',
    'http://localhost:3000/fonts/site.woff2',
    'http://localhost:3000/icons/app-icon.png',
    'http://localhost:3000/images/organization-logo.svg',
  ]

  for (const url of explicitlyPublicAssetUrls) {
    assert.equal(unstable_doesMiddlewareMatch({ config, url }), true, url)
    const response = await proxy(new NextRequest(url))
    assert.equal(response.status, 200, url)
  }
})

test('middleware preserves API and known static asset exclusions', async () => {
  const { updateSession } = await import('../../lib/supabase/middleware')
  const urls = [
    'http://localhost:3000/api/health/status',
    'http://localhost:3000/_next/static/chunks/app.js',
    'http://localhost:3000/favicon.ico',
    'http://localhost:3000/images/organization-logo.svg',
  ]

  for (const url of urls) {
    const response = await updateSession(new NextRequest(url))
    assert.equal(response.status, 200, url)
  }
})

test('item-detail page rejects an anonymous request before reading the item record', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setTableResponse('items', [
    { id: 'item-1', item_name: 'Restricted Item', item_type: 'asset', quantity: 1, status: 'active' },
  ])
  const { default: ItemDetailPage } = await import('../../app/(dashboard)/items/[id]/page')

  await assert.rejects(
    ItemDetailPage({ params: Promise.resolve({ id: 'item-1' }) }),
    (error: unknown) => {
      const redirectError = error as Error & { digest?: string }
      return redirectError.message === 'NEXT_REDIRECT'
        && redirectError.digest?.includes('/login') === true
    },
  )
  assert.equal(
    mockSupabaseRegistry.getQueryLog().some((entry) => entry.table === 'items'),
    false,
  )
})

test('getItemById honors session RLS denial instead of bypassing it with service credentials', async () => {
  mockSupabaseRegistry.clear()
  mockSupabaseRegistry.setTableResponse('items', [
    { id: 'item-1', item_name: 'Restricted Item', item_type: 'asset', quantity: 1, status: 'active' },
  ])
  mockSupabaseRegistry.setAnonTableError('items', { message: 'RLS denied' })
  const { getItemById } = await import('../../features/items/queries')

  await assert.rejects(getItemById('item-1'), /Unable to load item data/)
})
