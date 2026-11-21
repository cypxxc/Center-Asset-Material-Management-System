import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/ui/toast'

test('a lost cart response can be recovered even after every item disappears from the catalog', async () => {
  let recoveredKey = '', destination = '', submits = 0
  const key = 'b201679a-386a-4579-94c0-d0b4f717ef2a'
  Object.assign(globalThis, { sessionStorage: window.sessionStorage })
  sessionStorage.setItem('camms-pending-cart-request', JSON.stringify({ key, payload: 'saved cart' }))
  const actions = require.resolve('./actions')
  require.cache[actions] = { id: actions, filename: actions, loaded: true, exports: {
    recoverCartRequest: async (value: string) => { recoveredKey = value; return { success: true, data: { id: 'batch-id' } } },
    submitBorrowRequest: async () => { submits++; throw new Error('must not submit again') },
  } } as NodeJS.Module
  const navigation = require.resolve('next/navigation')
  require.cache[navigation] = { id: navigation, filename: navigation, loaded: true, exports: { useRouter: () => ({ push: (url: string) => { destination = url } }) } } as NodeJS.Module
  const { BorrowCatalogView } = await import('./components/borrow-catalog-view')
  const view = render(<ToastProvider><BorrowCatalogView items={[]} searchQuery="" /></ToastProvider>)
  fireEvent.click(await view.findByRole('button', { name: 'ตรวจสอบคำขอที่ส่งล่าสุด' }))
  await waitFor(() => assert.equal(destination, '/disbursements/batches/batch-id'))
  assert.equal(recoveredKey, key)
  assert.equal(submits, 0)
  assert.equal(sessionStorage.getItem('camms-pending-cart-request'), null)
})
