import '../setup/dom'
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { DeleteItemButton } from '../../features/items/components/delete-item-button'

afterEach(() => {
  cleanup()
})

let refreshed = false
let pushedUrl: string | null = null

const nextNavigationPath = require.resolve('next/navigation')
const nextNavigation = require.cache[nextNavigationPath]?.exports as {
  useRouter: () => { push: (url: string) => void; refresh: () => void }
}

nextNavigation.useRouter = () => ({
  push: (url: string) => { pushedUrl = url },
  refresh: () => { refreshed = true },
})

test('DeleteItemButton refreshes and redirects to /items on successful deletion', async () => {
  refreshed = false
  pushedUrl = null

  render(
    React.createElement(DeleteItemButton, {
      id: 'test-item-1',
      deleteAction: async () => ({ success: true, message: 'ลบรายการถาวรเรียบร้อยแล้ว' }),
    })
  )

  const deleteButton = screen.getByRole('button', { name: /ลบรายการ/ })
  fireEvent.click(deleteButton)

  let dialog!: HTMLElement
  await waitFor(() => {
    dialog = screen.getByRole('dialog') as HTMLElement
    assert.ok(dialog)
  })

  const confirmButton = within(dialog).getByRole('button', { name: 'ลบรายการ' })
  fireEvent.click(confirmButton)

  await waitFor(() => {
    assert.equal(refreshed, true, 'Expected router.refresh() to have been called')
    assert.equal(pushedUrl, '/items', 'Expected router.push("/items") to have been called')
  })
})

import { ToastProvider } from '../../components/ui/toast'

test('DeleteItemButton shows toast notification and does not redirect on deletion failure', async () => {
  refreshed = false
  pushedUrl = null

  render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(DeleteItemButton, {
        id: 'test-item-2',
        deleteAction: async () => ({ success: false, message: 'ไม่สามารถลบรายการได้' }),
      })
    )
  )

  const deleteButton = screen.getByRole('button', { name: /ลบรายการ/ })
  fireEvent.click(deleteButton)

  let dialog!: HTMLElement
  await waitFor(() => {
    dialog = screen.getByRole('dialog') as HTMLElement
    assert.ok(dialog)
  })

  const confirmButton = within(dialog).getByRole('button', { name: 'ลบรายการ' })
  fireEvent.click(confirmButton)

  await waitFor(() => {
    assert.ok(screen.getByText('ไม่สามารถลบรายการได้'))
    assert.equal(refreshed, false)
    assert.equal(pushedUrl, null)
  })
})
