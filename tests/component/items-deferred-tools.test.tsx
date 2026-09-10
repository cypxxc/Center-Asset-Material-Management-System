import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { render } from '@testing-library/react'

const load = createRequire(`${process.cwd()}/package.json`)
const mounted: string[] = []
const dynamicPath = load.resolve('next/dynamic')
load(dynamicPath)
load.cache[dynamicPath]!.exports = (loader: () => unknown) => function DeferredTool() {
  mounted.push(loader.toString())
  return null
}
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
const { ItemsExplorerClient } = load('./app/(dashboard)/items/items-explorer-client') as typeof import('../../app/(dashboard)/items/items-explorer-client')
const { ToastProvider } = load('./components/ui/toast') as typeof import('../../components/ui/toast')

test('closed explorer tools do not mount their dynamic loaders', () => {
  render(<ToastProvider><ItemsExplorerClient items={[]} total={0} page={1} totalPages={1} params={{}}
    userCanWrite userCanDelete locations={[]} categories={[]} units={[]} /></ToastProvider>)
  assert.deepEqual(mounted, [], 'closed edit/print tools must not request their chunks on mount')
})
