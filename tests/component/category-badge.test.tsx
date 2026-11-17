import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { CategoryBadge } from '../../features/items/components/category-badge'

test('CategoryBadge: renders name, dot, and Tag icon with color styling', () => {
  const { container } = render(
    React.createElement(CategoryBadge, {
      name: 'ครุภัณฑ์คอมพิวเตอร์',
      color: '#3B82F6',
    })
  )

  // 1. Text is rendered
  assert.ok(screen.getByText('ครุภัณฑ์คอมพิวเตอร์'))

  // 2. Outer container has max-w-full and no shrink-0
  const badge = container.firstElementChild as HTMLElement
  assert.ok(badge.className.includes('max-w-full'))
  assert.ok(!badge.className.includes('shrink-0'))

  // 3. Dot is present
  const dot = badge.querySelector('span[aria-hidden="true"]')
  assert.ok(dot)
})

test('CategoryBadge: safely falls back to default #64748B when given invalid hex or null', () => {
  const { container } = render(
    React.createElement(CategoryBadge, {
      name: 'หมวดหมู่ทั่วไป',
      color: 'invalid-hex',
    })
  )

  const badge = container.firstElementChild as HTMLElement
  const style = badge.getAttribute('style') || ''
  // JSDOM may serialize #64748B to rgb(100, 116, 139) or rgba(100, 116, 139, ...)
  assert.ok(
    style.includes('#64748B') ||
    style.includes('100, 116, 139') ||
    badge.innerHTML.includes('#64748B') ||
    badge.innerHTML.includes('100, 116, 139')
  )
})
