import '../setup/dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginPage from '../../app/(auth)/login/page'

test('LoginPage renders split-screen enterprise layout and branding', () => {
  render(React.createElement(LoginPage))

  // Branding & Mission
  assert.ok(screen.getByText('CAMMS'), 'Must render system acronym')
  assert.ok(
    screen.getByText('Center Asset Material Management System') ||
    screen.getByText(/Center Asset & Material Management System/i),
    'Must render full system title'
  )
  assert.ok(
    screen.getByText(/ระบบทะเบียนสิ่งของและครุภัณฑ์สำนักงานสำหรับการจัดเก็บ ตรวจสอบ และบริหารจัดการพัสดุอย่างเป็นระเบียบ/),
    'Must render mission statement'
  )

  // Capability Highlights
  assert.ok(screen.getByText(/ทะเบียนครุภัณฑ์และวัสดุสำนักงานครบวงจร/), 'Must render highlight 1')
  assert.ok(screen.getByText(/ควบคุมสิทธิ์การเข้าถึงตามระดับบทบาท/), 'Must render highlight 2')
  assert.ok(screen.getByText(/พิมพ์ป้ายสติกเกอร์รหัสทรัพย์สินและ QR Code/), 'Must render highlight 3')

  // Live status badge
  assert.ok(screen.getByText(/สถานะระบบ:\s*พร้อมใช้งานปกติ/), 'Must render operational status indicator')

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
