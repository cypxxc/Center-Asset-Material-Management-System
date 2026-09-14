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

test('Mobile navigation includes reports and locations and restores focus after Escape', async () => {
  render(<MobileNavigation profile={{ full_name: 'ผู้ทดสอบ', role: 'staff' }} />)
  const trigger = screen.getByRole('button', { name: 'เปิดเมนูนำทาง' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: 'เมนูนำทาง' })
  assert.equal(within(dialog).getByRole('link', { name: 'สถานที่จัดเก็บ' }).getAttribute('href'), '/locations')
  assert.equal(within(dialog).getByRole('link', { name: 'รายงานพัสดุ' }).getAttribute('href'), '/reports')
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
  fireEvent.click(within(dialog).getByRole('link', { name: 'รายงานพัสดุ' }))
  await waitFor(() => assert.equal(screen.queryByRole('dialog'), null))
})
