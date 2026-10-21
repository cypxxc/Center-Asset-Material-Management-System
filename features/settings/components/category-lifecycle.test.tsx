import '@/tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategorySection } from './metadata-sections'
import type { CategoryRow } from '../types'
import { getCategoryIconComponent, renderCategoryIconElement } from '@/lib/category-icons'
import { CategoryBadge } from '@/features/items/components/category-badge'

test('create -> select icon -> edit -> save -> reload simulated flow', () => {
  // Initial state with 1 category
  const initialCategories: CategoryRow[] = [
    {
      id: 'cat-it-1',
      name: 'อุปกรณ์ไอที',
      description: 'คอมพิวเตอร์และอุปกรณ์',
      color: '#3B82F6',
      icon: 'Tag', // initially defaulted
      is_active: true,
      updated_at: '2026-10-21T00:00:00.000Z',
    },
  ]

  // Render CategorySection
  const { rerender } = render(<CategorySection categories={initialCategories} />)

  // 1. Verify Create form contains CategoryIconPicker
  const createIconTrigger = screen.getAllByRole('button', { name: /เลือกไอคอนหมวดหมู่/i })[0]
  assert.ok(createIconTrigger)

  // 2. Verify Edit row contains CategoryIconPicker for existing category
  const editIconTrigger = screen.getAllByRole('button', { name: /เลือกไอคอนหมวดหมู่/i })[1]
  assert.ok(editIconTrigger)

  // 3. User edits icon: clicks trigger and selects 'Laptop'
  fireEvent.click(editIconTrigger)
  const laptopOption = screen.getByTitle(/Laptop/i)
  assert.ok(laptopOption)
  fireEvent.click(laptopOption)

  // The hidden input in the edit form now has value 'Laptop'
  const editFormInputs = document.querySelectorAll('form')[1].querySelectorAll('input[type="hidden"][name="icon"]')
  assert.equal(editFormInputs.length, 1)
  assert.equal((editFormInputs[0] as HTMLInputElement).value, 'Laptop')

  // 4. Simulate reload with updated database data (where icon is 'Laptop')
  const updatedCategories: CategoryRow[] = [
    {
      ...initialCategories[0],
      icon: 'Laptop',
      updated_at: '2026-10-21T01:00:00.000Z',
    },
  ]
  rerender(<CategorySection categories={updatedCategories} />)

  // Confirm re-rendered CategorySection displays 'Laptop' in trigger
  const reloadedTrigger = screen.getAllByRole('button', { name: /เลือกไอคอนหมวดหมู่/i })[1]
  assert.ok(reloadedTrigger.textContent?.includes('คอมพิวเตอร์พกพา/โน้ตบุ๊ก') || reloadedTrigger.textContent?.includes('Laptop'))
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
