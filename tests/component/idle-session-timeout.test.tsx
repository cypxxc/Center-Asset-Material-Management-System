import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IdleSessionTimeout } from '../../components/auth/idle-session-timeout'

// Enable React act() environment
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

test('IdleSessionTimeout renders nothing initially', () => {
  const { container } = render(
    React.createElement(IdleSessionTimeout, {
      timeoutSeconds: 100,
      warningSeconds: 10,
    })
  )

  assert.equal(container.innerHTML, '')
})

test('IdleSessionTimeout displays warning and counts down in realtime', async () => {
  const originalNow = Date.now
  let currentFakeTime = 1000000
  Date.now = () => currentFakeTime

  try {
    const { container } = render(
      React.createElement(IdleSessionTimeout, {
        timeoutSeconds: 20,
        warningSeconds: 10,
      })
    )

    // Initially, no warning
    assert.equal(container.innerHTML, '')

    // Fast-forward 11 seconds (elapsed = 11, remaining = 9 <= warningSeconds 10)
    currentFakeTime += 11000
    await act(async () => {
      // Trigger the 1000ms interval
      await new Promise((resolve) => setTimeout(resolve, 1100))
    })

    // Warning dialog should be visible now with 9 seconds remaining
    const warningTitle = screen.getByText(/แจ้งเตือนการหมดเวลาเซสชัน/i)
    assert.ok(warningTitle)
    assert.ok(screen.getByText(/9 วินาที/i))

    // Advance 2 more seconds
    currentFakeTime += 2000
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100))
    })

    // Realtime countdown should have updated to 7 seconds!
    assert.ok(screen.getByText(/7 วินาที/i))

    // Click "คงอยู่ในระบบต่อไป" (Stay Logged In)
    const stayBtn = screen.getByRole('button', { name: /คงอยู่ในระบบต่อไป/i })
    await act(async () => {
      fireEvent.click(stayBtn)
    })

    // Dialog should be closed
    assert.equal(container.innerHTML, '')
  } finally {
    Date.now = originalNow
  }
})
