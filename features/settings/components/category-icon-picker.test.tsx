import '@/tests/setup/dom'
import assert from 'node:assert/strict'
import test from 'node:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryIconPicker } from './category-icon-picker'
import { getCategoryIconComponent } from '@/lib/category-icons'
import { Laptop, Armchair, Car } from 'lucide-react'

test('CategoryIconPicker renders trigger with default icon and hidden input', () => {
  const { container } = render(<CategoryIconPicker defaultValue="Laptop" name="icon" />)

  const hiddenInput = container.querySelector('input[type="hidden"][name="icon"]') as HTMLInputElement
  assert.ok(hiddenInput)
  assert.equal(hiddenInput.value, 'Laptop')

  const trigger = screen.getByRole('button', { name: /เลือกไอคอนหมวดหมู่/i })
  assert.ok(trigger)
})

test('CategoryIconPicker opens popover on click and filters icons via search', () => {
  render(<CategoryIconPicker defaultValue="Tag" name="icon" />)

  const trigger = screen.getByRole('button', { name: /เลือกไอคอนหมวดหมู่/i })
  fireEvent.click(trigger)

  const searchInput = screen.getByPlaceholderText(/ค้นหาไอคอน/i)
  assert.ok(searchInput)

  // Search for 'คอม' or 'Laptop'
  fireEvent.change(searchInput, { target: { value: 'Laptop' } })

  const laptopOption = screen.getByTitle(/Laptop/i)
  assert.ok(laptopOption)
})

test('CategoryIconPicker selecting an icon updates hidden input and calls onChange', () => {
  let changedValue = ''
  const { container } = render(
    <CategoryIconPicker
      defaultValue="Tag"
      name="icon"
      onChange={(val) => {
        changedValue = val
      }}
    />
  )

  const trigger = screen.getByRole('button', { name: /เลือกไอคอนหมวดหมู่/i })
  fireEvent.click(trigger)

  const searchInput = screen.getByPlaceholderText(/ค้นหาไอคอน/i)
  fireEvent.change(searchInput, { target: { value: 'Armchair' } })

  const armchairOption = screen.getByTitle(/Armchair/i)
  fireEvent.click(armchairOption)

  assert.equal(changedValue, 'Armchair')

  const hiddenInput = container.querySelector('input[type="hidden"][name="icon"]') as HTMLInputElement
  assert.equal(hiddenInput.value, 'Armchair')
})

test('getCategoryIconComponent resolves explicit icon and falls back to name heuristic', () => {
  // Explicit whitelisted icon
  assert.equal(getCategoryIconComponent('Car'), Car)

  // Heuristic from Thai category name when icon is empty or null
  assert.equal(getCategoryIconComponent(null, 'ครุภัณฑ์คอมพิวเตอร์'), Laptop)
  assert.equal(getCategoryIconComponent(undefined, 'โต๊ะทำงานและเก้าอี้'), Armchair)
  assert.equal(getCategoryIconComponent('', 'ยานพาหนะและขนส่ง'), Car)

  // Fallback to Tag if non-matching
  const fallback = getCategoryIconComponent(null, 'หมวดหมู่ทั่วไปที่ไม่ตรงคีย์เวิร์ด')
  assert.ok(fallback)
})
