import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent } from '@testing-library/react'
import { ItemTableRow, type ItemTableRowProps } from '../../features/items/components/items-list-view'
import type { ItemListRow } from '../../features/items/types'

const mockItem: ItemListRow = {
  id: 'item-1',
  item_name: 'คอมพิวเตอร์ตั้งโต๊ะ All-in-One Dell Inspiron',
  item_type: 'asset',
  category: { id: 'cat-1', name: 'อุปกรณ์ไอที' },
  location: { id: 'loc-1', name: 'ห้องปฏิบัติการ 2' },
  unit: { id: 'unit-1', name: 'ชุด' },
  quantity: 5,
  unit_price: 28500,
  asset_no: 'EQ-2026-050',
  serial_no: 'SN-DELL-8833',
  brand: 'Dell',
  model: 'Inspiron 24',
  responsible_person: 'นางสาววิภา คอมพิวเตอร์',
  status: 'active',
  note: null,
  image_url: 'https://example.com/desktop.jpg',
  updated_at: '2026-02-01T00:00:00Z',
}

function renderRow(props: Partial<ItemTableRowProps> = {}) {
  let selected = false
  let checked = false

  const defaultProps: ItemTableRowProps = {
    item: mockItem,
    isSelected: false,
    isChecked: false,
    onSelect: () => { selected = true },
    onDoubleClick: () => {},
    onToggleSelectItem: () => { checked = true },
    isInspectorOpen: false,
    ...props,
  }

  // Render inside a table wrapper so <tr> and <td> are valid DOM
  const result = render(
    <table>
      <tbody>
        <ItemTableRow {...defaultProps} />
      </tbody>
    </table>
  )

  return { ...result, getSelected: () => selected, getChecked: () => checked }
}

test('ItemTableRow: renders compound item name, asset badge, and thumbnail', () => {
  renderRow()

  assert.ok(screen.getByText('คอมพิวเตอร์ตั้งโต๊ะ All-in-One Dell Inspiron'))
  assert.ok(screen.getByText('EQ-2026-050'))
  assert.ok(screen.getByText('• Dell Inspiron 24'))
  assert.ok(screen.getByTestId('item-thumbnail'))
  assert.ok(screen.getByText('5'))
  assert.ok(screen.getByText('ชุด'))
  assert.ok(screen.getByText('ห้องปฏิบัติการ 2'))
})

test('ItemTableRow: clicking checkbox calls onToggleSelectItem and stops propagation to onSelect', () => {
  let selectCalled = false
  let toggleCalled = false

  render(
    <table>
      <tbody>
        <ItemTableRow
          item={mockItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => { selectCalled = true }}
          onToggleSelectItem={() => { toggleCalled = true }}
        />
      </tbody>
    </table>
  )

  const checkbox = screen.getByLabelText(`เลือก ${mockItem.item_name}`)
  fireEvent.click(checkbox)

  assert.equal(toggleCalled, true, 'checkbox toggle should be called')
  assert.equal(selectCalled, false, 'row selection should NOT be triggered on checkbox click (stopPropagation)')
})

test('ItemTableRow: clicking row calls onSelect', () => {
  let selectedItem: ItemListRow | null = null

  render(
    <table>
      <tbody>
        <ItemTableRow
          item={mockItem}
          isSelected={false}
          isChecked={false}
          onSelect={(item) => { selectedItem = item }}
          onToggleSelectItem={() => {}}
        />
      </tbody>
    </table>
  )

  fireEvent.click(screen.getByText('คอมพิวเตอร์ตั้งโต๊ะ All-in-One Dell Inspiron'))
  assert.equal((selectedItem as ItemListRow | null)?.id, 'item-1')
})

test('ItemTableRow: responsive column classes when isInspectorOpen is false', () => {
  const { container } = render(
    <table>
      <tbody>
        <ItemTableRow
          item={mockItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => {}}
          onToggleSelectItem={() => {}}
          isInspectorOpen={false}
        />
      </tbody>
    </table>
  )

  const cells = container.querySelectorAll('td')
  // Cell 3: Item Type
  assert.ok(cells[3].classList.contains('sm:table-cell'), 'type cell visible from sm when inspector closed')
  assert.equal(cells[3].classList.contains('xl:table-cell'), false)

  // Cell 4: Category
  assert.ok(cells[4].classList.contains('md:table-cell'), 'category cell visible from md when inspector closed')
  assert.equal(cells[4].classList.contains('2xl:table-cell'), false)

  // Cell 7: Responsible Person
  assert.ok(cells[7].classList.contains('xl:table-cell'), 'responsible person cell visible from xl when inspector closed')
  assert.equal(cells[7].classList.contains('2xl:table-cell'), false)
})

test('ItemTableRow: responsive column classes collapse when isInspectorOpen is true', () => {
  const { container } = render(
    <table>
      <tbody>
        <ItemTableRow
          item={mockItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => {}}
          onToggleSelectItem={() => {}}
          isInspectorOpen={true}
        />
      </tbody>
    </table>
  )

  const cells = container.querySelectorAll('td')
  // Cell 3: Item Type
  assert.ok(cells[3].classList.contains('xl:table-cell'), 'type cell collapses to xl when inspector open')
  assert.equal(cells[3].classList.contains('sm:table-cell'), false)

  // Cell 4: Category
  assert.ok(cells[4].classList.contains('2xl:table-cell'), 'category cell collapses to 2xl when inspector open')
  assert.equal(cells[4].classList.contains('md:table-cell'), false)

  // Cell 7: Responsible Person
  assert.ok(cells[7].classList.contains('2xl:table-cell'), 'responsible person cell collapses to 2xl when inspector open')
  assert.equal(cells[7].classList.contains('xl:table-cell'), false)
})

test('ItemTableRow: clicking copy asset badge calls onCopy and stops propagation', () => {
  let copiedValue: string | null = null
  let selectCalled = false

  render(
    <table>
      <tbody>
        <ItemTableRow
          item={mockItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => { selectCalled = true }}
          onToggleSelectItem={() => {}}
          onCopy={(val) => { copiedValue = val ?? null }}
        />
      </tbody>
    </table>
  )

  const copyBadge = screen.getByLabelText(`คัดลอก ${mockItem.asset_no}`)
  fireEvent.click(copyBadge)

  assert.equal(copiedValue, mockItem.asset_no)
  assert.equal(selectCalled, false, 'clicking copy badge must not select row')
})

test('ItemTableRow: does not render print barcode or edit buttons in table row to keep row clean', () => {
  render(
    <table>
      <tbody>
        <ItemTableRow
          item={mockItem}
          isSelected={false}
          isChecked={false}
          userCanWrite={true}
          onSelect={() => {}}
          onToggleSelectItem={() => {}}
          onPrint={() => {}}
          onEdit={() => {}}
        />
      </tbody>
    </table>
  )

  // Print and edit buttons MUST NOT be in the table row
  assert.equal(screen.queryByLabelText(`พิมพ์ป้ายบาร์โค้ด ${mockItem.item_name}`), null)
  assert.equal(screen.queryByLabelText(`แก้ไขข้อมูล ${mockItem.item_name}`), null)
})

test('ItemTableRow: maintains strict 64px height classes for virtual scrolling compatibility', () => {
  const { container } = render(
    <table>
      <tbody>
        <ItemTableRow
          item={mockItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => {}}
          onToggleSelectItem={() => {}}
        />
      </tbody>
    </table>
  )

  const tr = container.querySelector('tr')
  assert.ok(tr, 'tr should exist')
  assert.ok(tr.classList.contains('h-[64px]'), 'row must have explicit h-[64px] for virtual scrolling')
  assert.ok(tr.classList.contains('max-h-[64px]'), 'row must have max-h-[64px]')
  assert.ok(tr.classList.contains('[&>td]:h-[64px]'), 'td elements must have h-[64px]')
  assert.ok(tr.classList.contains('[&>td]:py-0'), 'td elements must have py-0 to prevent height bloating')
})

test('ItemTableRow: handles long Thai item name with safe truncation and full title tooltip', () => {
  const longNameItem: ItemListRow = {
    ...mockItem,
    id: 'long-item-1',
    item_name: 'เครื่องถ่ายเอกสารมัลติฟังก์ชันระบบดิจิตอลสีความเร็วสูงพร้อมชุดเย็บเล่มและพับเอกสารอัตโนมัติประจำสำนักงานส่วนกลาง',
  }

  const { container } = render(
    <table>
      <tbody>
        <ItemTableRow
          item={longNameItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => {}}
          onToggleSelectItem={() => {}}
        />
      </tbody>
    </table>
  )

  const nameSpan = container.querySelector(`span[title="${longNameItem.item_name}"]`)
  assert.ok(nameSpan, 'name span with full title tooltip must exist')
  assert.ok(nameSpan.classList.contains('truncate'), 'name span must have truncate class to prevent column breaking')
  assert.equal(nameSpan.textContent, longNameItem.item_name)
})

test('ItemTableRow: handles long asset code, copy button, feedback icon, and event isolation', () => {
  const longAssetCode = '7110-001-0001/2567-สนง-กทม-00982-พิเศษ'
  const longCodeItem: ItemListRow = {
    ...mockItem,
    id: 'long-code-item',
    asset_no: longAssetCode,
  }

  let copiedValue: string | null = null
  let selectCalled = false

  render(
    <table>
      <tbody>
        <ItemTableRow
          item={longCodeItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => { selectCalled = true }}
          onToggleSelectItem={() => {}}
          onCopy={(val) => { copiedValue = val ?? null }}
        />
      </tbody>
    </table>
  )

  const copyButton = screen.getByLabelText(`คัดลอก ${longAssetCode}`)
  assert.ok(copyButton, 'copy button must exist')
  assert.equal(copyButton.getAttribute('title'), `คัดลอก ${longAssetCode}`)

  // Click to copy
  fireEvent.click(copyButton)

  assert.equal(copiedValue, longAssetCode, 'must copy exact full long asset code')
  assert.equal(selectCalled, false, 'clicking copy must not trigger row onSelect')
})

test('ItemTableRow: handles multi-level location and long responsible person with truncation and title attributes', () => {
  const deepLocation = 'อาคารเฉลิมพระเกียรติ 80 พรรษา > ชั้น 4 > ปีกตะวันออก > ห้องประชุมกลุ่มงานยุทธศาสตร์และงบประมาณ (402/1)'
  const longPerson = 'ดร.สมชาย วงศ์วิริยะพัฒนาการ (ผู้อำนวยการส่วนเทคโนโลยีสารสนเทศและการสื่อสาร)'

  const complexItem: ItemListRow = {
    ...mockItem,
    location: { id: 'loc-deep', name: deepLocation },
    responsible_person: longPerson,
  }

  const { container } = render(
    <table>
      <tbody>
        <ItemTableRow
          item={complexItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => {}}
          onToggleSelectItem={() => {}}
          isInspectorOpen={false}
        />
      </tbody>
    </table>
  )

  // Location cell
  const locationCell = container.querySelector(`td[title="${deepLocation}"]`)
  assert.ok(locationCell, 'location cell should have full title attribute for accessibility/tooltip')
  assert.ok(locationCell.classList.contains('truncate'), 'location cell must have truncate class')

  // Responsible person cell
  const personCell = container.querySelector(`td[title="${longPerson}"]`)
  assert.ok(personCell, 'person cell should have full title attribute for accessibility/tooltip')
  assert.ok(personCell.classList.contains('truncate'), 'person cell must have truncate class')
})

test('ItemTableRow: formats quantity with tabular-nums for vertical eye-scanning', () => {
  render(
    <table>
      <tbody>
        <ItemTableRow
          item={{ ...mockItem, quantity: 1250 }}
          isSelected={false}
          isChecked={false}
          onSelect={() => {}}
          onToggleSelectItem={() => {}}
        />
      </tbody>
    </table>
  )

  const quantitySpan = screen.getByText('1250')
  assert.ok(quantitySpan.classList.contains('tabular-nums'), 'quantity must use tabular-nums for aligned scanning')
  assert.ok(quantitySpan.classList.contains('font-extrabold'), 'quantity must use font-extrabold for prominent hierarchy')

  const quantityCell = quantitySpan.closest('td')
  assert.ok(quantityCell?.classList.contains('text-right'), 'quantity cell must be right-aligned for enterprise comparison')
})

test('ItemTableRow: renders cleanly with hyphens and no broken tooltips when metadata is missing', () => {
  const minimalItem: ItemListRow = {
    ...mockItem,
    id: 'item-minimal',
    category: null,
    location: null,
    responsible_person: null,
    unit: null,
    brand: null,
    model: null,
  }

  const { container } = render(
    <table>
      <tbody>
        <ItemTableRow
          item={minimalItem}
          isSelected={false}
          isChecked={false}
          onSelect={() => {}}
          onToggleSelectItem={() => {}}
        />
      </tbody>
    </table>
  )

  // Verify missing values display clean hyphens
  const hyphenElements = screen.getAllByText('-')
  assert.ok(hyphenElements.length >= 3, 'missing category, location, and person should display "-"')

  // Verify no cell has title="undefined"
  assert.equal(container.querySelector('td[title="undefined"]'), null)
})


