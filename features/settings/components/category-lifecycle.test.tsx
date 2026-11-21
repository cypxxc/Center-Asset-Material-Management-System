import '@/tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen } from '@testing-library/react'
import { CategorySection } from './metadata-sections'
import type { CategoryRow } from '../types'
import { getCategoryIconComponent, renderCategoryIconElement } from '@/lib/category-icons'
import { CategoryBadge } from '@/features/items/components/category-badge'

test('category tabs isolate matching rows and submit their type while preserving hidden metadata', () => {
  // Initial state with 1 category
  const initialCategories: CategoryRow[] = [
    {
      id: 'cat-it-1',
      item_type: 'asset',
      name: 'อุปกรณ์ไอที',
      description: 'คอมพิวเตอร์และอุปกรณ์',
      color: '#3B82F6',
      icon: 'Tag', // initially defaulted
      is_active: true,
      updated_at: '2026-10-21T00:00:00.000Z',
    },
  ]

  const material: CategoryRow = { ...initialCategories[0], id: 'cat-material', item_type: 'material', name: 'กระดาษ', icon: 'FileText' }
  const categories = [...initialCategories, material]
  const { container, rerender } = render(<CategorySection categories={categories} itemType="asset" />)
  assert.ok(screen.getByRole('textbox', { name: 'ชื่อหมวดหมู่ อุปกรณ์ไอที' }))
  assert.equal(screen.queryByRole('textbox', { name: 'ชื่อหมวดหมู่ กระดาษ' }), null)
  assert.equal((container.querySelector('form [name=item_type]') as HTMLInputElement).value, 'asset')
  rerender(<CategorySection key="material" categories={categories} itemType="material" />)
  assert.ok(screen.getByRole('textbox', { name: 'ชื่อหมวดหมู่ กระดาษ' }))
  assert.equal(screen.queryByRole('textbox', { name: 'ชื่อหมวดหมู่ อุปกรณ์ไอที' }), null)
  assert.equal((container.querySelector('form [name=item_type]') as HTMLInputElement).value, 'material')
  const editForm = container.querySelector('form#category-cat-material')!
  assert.equal((editForm.querySelector('[name=item_type]') as HTMLInputElement).value, 'material')
  assert.equal((editForm.querySelector('[name=icon]') as HTMLInputElement).value, 'FileText')
  assert.equal((editForm.querySelector('[name=color]') as HTMLInputElement).value, '#3B82F6')
})

test('CategoryBadge renders category icon in list, grid, and drawer contexts', () => {
  // 1. Category with explicit icon 'Laptop'
  const { container: container1 } = render(
    <CategoryBadge name="อุปกรณ์ไอที" color="#3B82F6" icon="Laptop" />
  )
  const svg1 = container1.querySelector('svg.lucide-laptop')
  assert.ok(svg1, 'Should render Lucide Laptop icon')

  // 2. Legacy category with NULL/empty icon using keyword heuristic ('เฟอร์' -> Armchair)
  const { container: container2 } = render(
    <CategoryBadge name="เฟอร์นิเจอร์สำนักงาน" color="#64748B" icon={null} />
  )
  const svg2 = container2.querySelector('svg.lucide-armchair')
  assert.ok(svg2, 'Should render Lucide Armchair icon via heuristic')

  // 3. Category without icon and non-matching name falls back to FileText
  const { container: container3 } = render(
    <CategoryBadge name="หมวดหมู่อื่นๆ" color="#64748B" icon={null} />
  )
  const svg3 = container3.querySelector('svg.lucide-file-text')
  assert.ok(svg3, 'Should render Lucide FileText icon as default')
})

test('Sidebar category icon rendering with explicit icon and heuristic fallback', () => {
  // Test renderCategoryIconElement directly as used in sidebar.tsx
  const element1 = renderCategoryIconElement('Car', 'ยานพาหนะ')
  const element2 = renderCategoryIconElement(null, 'ครุภัณฑ์คอมพิวเตอร์')
  const element3 = renderCategoryIconElement(undefined, 'เบ็ดเตล็ด')

  assert.equal(element1.type, getCategoryIconComponent('Car'))
  assert.equal(element2.type, getCategoryIconComponent(null, 'ครุภัณฑ์คอมพิวเตอร์'))
  assert.equal(element3.type, getCategoryIconComponent(undefined, 'เบ็ดเตล็ด'))
})
