import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import DashboardError from '../../app/(dashboard)/dashboard/error'

test('database failure offers retry without showing misleading zero totals', () => {
  let retries = 0
  render(React.createElement(DashboardError, { error: new Error('private connection details'), retry: () => { retries++ } }))
  assert.ok(screen.getByRole('alert'))
  assert.equal(screen.queryByText(/private connection details/), null)
  assert.equal(screen.queryByText('0 รายการ'), null)
  fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่อีกครั้ง' }))
  assert.equal(retries, 1)
})
