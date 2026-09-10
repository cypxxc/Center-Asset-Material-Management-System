import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ItemListRow } from '../../features/items/types'
const load = createRequire(`${process.cwd()}/package.json`)
let refreshes = 0
let succeed = true
let writes = 0
const navigation = load('next/navigation')
navigation.useRouter = () => ({ refresh: () => { refreshes++ }, push: () => {} })
const actionId = load.resolve('./features/items/actions')
load.cache[actionId] = { id: actionId, filename: actionId, loaded: true, exports: {
  bulkUpdateItems: async () => { writes++; return { success: succeed, message: 'result' } },
  bulkHardDeleteItems: async () => ({ success: true }),
} } as NodeJS.Module
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
const { ItemsExplorerClient } = load('./app/(dashboard)/items/items-explorer-client') as typeof import('../../app/(dashboard)/items/items-explorer-client')
const { ToastProvider } = load('./components/ui/toast') as typeof import('../../components/ui/toast')
const items: ItemListRow[] = [{ id: 'one', item_name: 'Test item', item_type: 'asset', quantity: 1, unit_price: 0, asset_no: null, serial_no: null, responsible_person: null, status: 'active', updated_at: '2026-01-01', category: null, unit: null, location: null }]

test('bulk success relies on the action RSC response without a second refresh; failure restores row', async () => {
  render(<ToastProvider><ItemsExplorerClient items={items} total={1} page={1} totalPages={1} params={{}}
    userCanWrite userCanDelete locations={[]} categories={[]} units={[]} /></ToastProvider>)
  fireEvent.click(screen.getAllByRole('checkbox')[0])
  await act(async () => { fireEvent.change(screen.getByLabelText('เปลี่ยนสถานะรายการที่เลือก'), { target: { value: 'damaged' } }) })
  assert.equal(writes, 1)
  assert.equal(refreshes, 0)
  succeed = false
  fireEvent.click(screen.getAllByRole('checkbox')[0])
  await act(async () => { fireEvent.change(screen.getByLabelText('เปลี่ยนสถานะรายการที่เลือก'), { target: { value: 'spare' } }) })
  assert.equal(writes, 2)
  assert.ok(screen.getByText('การดำเนินงานล้มเหลว'))
  assert.equal(refreshes, 0)
})
