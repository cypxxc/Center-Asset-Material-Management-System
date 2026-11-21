import '../../../tests/setup/dom'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent } from '@testing-library/react'
import { BorrowCartButton } from './borrow-cart-button'
import { BorrowCartDrawer } from './borrow-cart-drawer'
import type { CentralAvailableItem } from '@/features/disbursements/types'

const mockItems: CentralAvailableItem[] = [
  {
    id: 'item-1',
    item_name: 'เครื่องคอมพิวเตอร์ All-in-One Dell OptiPlex',
    asset_no: 'ศท-01-2567',
    serial_no: 'SN123456',
    brand: 'Dell',
    model: 'OptiPlex 7400',
    item_type: 'asset',
    quantity: 1,
    unit_name: 'เครื่อง',
    category: { id: 'cat-1', name: 'อุปกรณ์คอมพิวเตอร์' },
    location_name: 'ห้องศูนย์ข้อมูล ชั้น 3',
    image_url: null,
    unavailable_reason: null,
  },
  {
    id: 'item-2',
    item_name: 'โปรเจคเตอร์ Epson EB-X51',
    asset_no: 'ศท-02-2567',
    serial_no: 'SN789012',
    brand: 'Epson',
    model: 'EB-X51',
    item_type: 'asset',
    quantity: 1,
    unit_name: 'เครื่อง',
    category: { id: 'cat-2', name: 'โสตทัศนูปกรณ์' },
    location_name: 'ห้องประชุมใหญ่ ชั้น 2',
    image_url: null,
    unavailable_reason: null,
  },
]

describe('BorrowCartButton', () => {
  it('renders cart button with 0 items', () => {
    render(<BorrowCartButton count={0} onClick={() => {}} />)
    assert.ok(screen.getByText('ตะกร้า (0)'))
  })

  it('renders badge count when items exist', () => {
    render(<BorrowCartButton count={2} onClick={() => {}} />)
    assert.ok(screen.getByText('ตะกร้า (2)'))
  })

  it('triggers onClick callback when clicked', () => {
    let clicked = false
    render(<BorrowCartButton count={1} onClick={() => { clicked = true }} />)
    const button = screen.getByRole('button', { name: /ตะกร้า \(1\)/i })
    fireEvent.click(button)
    assert.strictEqual(clicked, true)
  })
})

describe('BorrowCartDrawer', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(
      <BorrowCartDrawer
        isOpen={false}
        onClose={() => {}}
        items={mockItems}
        selectedIds={new Set(['item-1'])}
        onRemoveItem={() => {}}
        onClearAll={() => {}}
        onProceedToSubmit={() => {}}
      />
    )
    assert.strictEqual(container.firstChild, null)
  })

  it('renders empty state when no items selected', () => {
    render(
      <BorrowCartDrawer
        isOpen={true}
        onClose={() => {}}
        items={mockItems}
        selectedIds={new Set()}
        onRemoveItem={() => {}}
        onClearAll={() => {}}
        onProceedToSubmit={() => {}}
      />
    )
    assert.ok(screen.getByText('ยังไม่มีรายการในตะกร้า'))
  })

  it('renders selected items and handles removal', () => {
    let removedId = ''
    render(
      <BorrowCartDrawer
        isOpen={true}
        onClose={() => {}}
        items={mockItems}
        selectedIds={new Set(['item-1', 'item-2'])}
        onRemoveItem={(id) => { removedId = id }}
        onClearAll={() => {}}
        onProceedToSubmit={() => {}}
      />
    )

    assert.ok(screen.getByText('เครื่องคอมพิวเตอร์ All-in-One Dell OptiPlex'))
    assert.ok(screen.getByText('โปรเจคเตอร์ Epson EB-X51'))
    assert.ok(screen.getByText('ศท-01-2567'))

    // Click remove on first item
    const removeBtn = screen.getByLabelText('นำ เครื่องคอมพิวเตอร์ All-in-One Dell OptiPlex ออกจากตะกร้า')
    fireEvent.click(removeBtn)
    assert.strictEqual(removedId, 'item-1')
  })

  it('triggers proceedToSubmit callback when clicking submit', () => {
    let proceeded = false
    render(
      <BorrowCartDrawer
        isOpen={true}
        onClose={() => {}}
        items={mockItems}
        selectedIds={new Set(['item-1'])}
        onRemoveItem={() => {}}
        onClearAll={() => {}}
        onProceedToSubmit={() => { proceeded = true }}
      />
    )

    const proceedBtn = screen.getByRole('button', { name: /ดำเนินการต่อ/i })
    fireEvent.click(proceedBtn)
    assert.strictEqual(proceeded, true)
  })
})
