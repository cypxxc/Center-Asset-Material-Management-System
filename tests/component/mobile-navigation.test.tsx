import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MobileNavigation } from '../../components/layout/mobile-navigation'

Object.assign(globalThis, {
  MutationObserver: window.MutationObserver,
  NodeFilter: window.NodeFilter,
  Node: window.Node,
  CustomEvent: window.CustomEvent,
  getComputedStyle: window.getComputedStyle.bind(window),
})

test('Mobile navigation has one inventory entry and restores focus after Escape', async () => {
  render(<MobileNavigation profile={{ full_name: 'ผู้ทดสอบ', role: 'staff' }} />)
  const trigger = screen.getByRole('button', { name: 'เปิดเมนูนำทาง' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'เมนูนำทาง' })
  const inventoryLinks = within(dialog).getAllByRole('link', { name: 'คลัง' })
  assert.equal(inventoryLinks.length, 1)
  assert.equal(inventoryLinks[0].getAttribute('href'), '/items')
  assert.equal(within(dialog).queryByRole('link', { name: /สถานที่|รายงาน/ }), null)
  assert.ok(within(dialog).getByRole('button', { name: 'ปิดเมนูนำทาง' }))
  assert.ok(dialog.contains(document.activeElement))
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() => assert.equal(screen.queryByRole('dialog'), null))
  await waitFor(() => assert.equal(document.activeElement, trigger))
})

test('Viewer navigation excludes write-only settings and closes after choosing a page', async () => {
  render(<MobileNavigation profile={{ full_name: 'ผู้ชม', role: 'viewer' }} />)
  fireEvent.click(screen.getByRole('button', { name: 'เปิดเมนูนำทาง' }))
  const dialog = await screen.findByRole('dialog')
  assert.equal(within(dialog).queryByRole('link', { name: /ตั้งค่าระบบ/ }), null)
  fireEvent.click(within(dialog).getByRole('link', { name: 'คลัง' }))
  await waitFor(() => assert.equal(screen.queryByRole('dialog'), null))
})
