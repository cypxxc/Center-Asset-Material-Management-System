import '../setup/dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from '../../app/(auth)/login/page'

test('LoginPage renders Curved Split-Screen Dark Editorial layout and CAMMS branding', () => {
  render(React.createElement(LoginPage))

  // Branding & Title
  assert.ok(screen.getByText('CAMMS Portal'), 'Must render system acronym')
  assert.ok(
    screen.getByText(/Center Asset & Material Management System/),
    'Must render full system title'
  )
  assert.ok(
    screen.getByRole('heading', { name: /เข้าสู่ระบบจัดการพัสดุและครุภัณฑ์/ }),
    'Must render headline'
  )
  assert.ok(
    screen.getByText(/ยินดีต้อนรับเข้าสู่ระบบ • OFFICIAL PORTAL/),
    'Must render official portal kicker'
  )
  assert.ok(
    screen.getByText(/กรอกข้อมูลบัญชีเพื่อเข้าใช้งานระบบ/),
    'Must render sign in description'
  )

  // Security indicator
  assert.ok(
    screen.getByText(/ระบบความปลอดภัยพร้อมใช้งาน \(256-bit Encrypted Session\)/),
    'Must render security verified status indicator'
  )

  // Form Fields & Labels
  assert.ok(screen.getByLabelText(/รหัสผู้ใช้/), 'Must render identifier field')
  assert.ok(screen.getByLabelText(/^รหัสผ่าน/), 'Must render password field')
  assert.ok(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }), 'Must render submit button')
})

test('LoginPage toggles password visibility when toggle button is clicked', () => {
  render(React.createElement(LoginPage))

  const passwordInput = screen.getByLabelText(/^รหัสผ่าน/) as HTMLInputElement
  assert.strictEqual(passwordInput.type, 'password', 'Password input starts with type="password"')

  const toggleBtn = screen.getByRole('button', { name: 'แสดงรหัสผ่าน' })
  fireEvent.click(toggleBtn)

  assert.strictEqual(passwordInput.type, 'text', 'Password input changes to type="text" after toggle')

  const hideBtn = screen.getByRole('button', { name: 'ซ่อนรหัสผ่าน' })
  fireEvent.click(hideBtn)

  assert.strictEqual(passwordInput.type, 'password', 'Password input toggles back to type="password"')
})
