import '../setup/dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen } from '@testing-library/react'
import LoginPage from '../../app/(auth)/login/page'

test('LoginPage renders the system name and minimal credential form', () => {
  render(React.createElement(LoginPage))

  const identifier = screen.getByLabelText('ชื่อผู้ใช้') as HTMLInputElement
  const password = screen.getByLabelText('รหัสผ่าน') as HTMLInputElement

  assert.ok(screen.getByRole('heading', { name: 'CAMMS Portal' }))
  assert.equal(identifier.placeholder, 'ชื่อผู้ใช้')
  assert.equal(identifier.type, 'text')
  assert.equal(password.placeholder, 'รหัสผ่าน')
  assert.equal(password.type, 'password')
  assert.ok(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))
})
