import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent } from '@testing-library/react'
import { LiveSidebarProvider, useLiveSidebar, type SidebarData } from '../../components/layout/live-sidebar'
const data = (count: number): SidebarData => ({ categories: [], locations: [], counts: { total_assets: count, total_supplies: 0, archive_count: 0, trash_count: 0 } })
function Consumer() {
  const sidebar = useLiveSidebar()
  return <button onClick={() => sidebar.update(data(2))}>{sidebar.data?.counts.total_assets}</button>
}
test('sidebar accepts targeted data and a new server response replaces earlier live state', () => {
  const view = render(<LiveSidebarProvider data={data(1)}><Consumer /></LiveSidebarProvider>)
  fireEvent.click(screen.getByRole('button'))
  assert.equal(screen.getByRole('button').textContent, '2')
  view.rerender(<LiveSidebarProvider data={data(3)}><Consumer /></LiveSidebarProvider>)
  assert.equal(screen.getByRole('button').textContent, '3')
})
