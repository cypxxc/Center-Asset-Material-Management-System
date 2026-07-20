import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { HeaderGuideDialog } from '../../components/layout/header-guide-dialog'

test('HeaderGuideDialog renders the guide and closes accessibly', () => {
  let closeCount = 0
  render(
    React.createElement(HeaderGuideDialog, {
      onClose: () => {
        closeCount += 1
      },
    }),
  )

  assert.ok(screen.getByRole('heading', { name: /CAMMS User Guide/ }))
  fireEvent.click(screen.getByRole('button', { name: 'ปิดคู่มือการใช้งาน' }))
  assert.equal(closeCount, 1)
})
