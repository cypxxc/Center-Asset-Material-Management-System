import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { useEffect, useRef } from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { useItemWindow } from '../../features/items/use-item-window'
import type { ItemBatchResult, ItemListRow } from '../../features/items/types'

function createMockItems(count: number, startIndex = 0): ItemListRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${startIndex + i}`,
    item_name: `พัสดุทดสอบ ${startIndex + i}`,
    item_type: 'asset',
    quantity: 1,
    unit_price: 1000,
    asset_no: `EQ-2026-${String(startIndex + i).padStart(4, '0')}`,
    serial_no: null,
    responsible_person: 'เจ้าหน้าที่พัสดุ',
    status: 'active',
    updated_at: '2026-01-01T00:00:00Z',
    category: { id: 'cat-1', name: 'อุปกรณ์' },
    unit: { id: 'unit-1', name: 'เครื่อง' },
    location: { id: 'loc-1', name: 'ห้อง 101' },
  }))
}

interface HarnessProps {
  seed: ItemBatchResult
  onReady: (hook: ReturnType<typeof useItemWindow>, container: HTMLDivElement) => void
  view?: 'list' | 'grid'
}

function WindowHarness({ seed, onReady, view = 'list' }: HarnessProps) {
  const hook = useItemWindow('test-scroll-session', {}, seed)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (view !== hook.view) {
      hook.setView(view)
    }
  }, [view, hook])

  useEffect(() => {
    const el = containerRef.current
    if (el) {
      Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true })
      Object.defineProperty(el, 'clientWidth', { value: 1000, configurable: true })
      Object.defineProperty(el, 'scrollHeight', { value: 10000, configurable: true })
      hook.attachScroll(el)
      onReady(hook, el)
    }
  })

  return (
    <div
      ref={containerRef}
      data-testid="scroll-container"
      style={{ height: 600, width: 1000, overflow: 'auto' }}
    >
      <div style={{ height: hook.topSpace }} />
      {hook.slots.map((item, idx) => (
        <div key={item?.id ?? `slot-${idx}`} style={{ height: hook.view === 'list' ? 64 : 220 }}>
          {item?.item_name ?? 'กำลังโหลด...'}
        </div>
      ))}
      <div style={{ height: hook.bottomSpace }} />
    </div>
  )
}

test('scrollToIndex: safely ignores invalid indices and empty datasets', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  // Empty data test
  const emptySeed: ItemBatchResult = { items: [], total: 0, nextCursor: null }
  const { rerender } = render(
    <WindowHarness
      seed={emptySeed}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  containerEl.scrollTop = 0
  act(() => {
    hookInstance.scrollToIndex(0)
  })
  assert.equal(containerEl.scrollTop, 0, 'empty dataset should not move scrollTop')

  // Re-render with items
  const items = createMockItems(50)
  const seedWithItems: ItemBatchResult = { items, total: 50, nextCursor: null }
  rerender(
    <WindowHarness
      seed={seedWithItems}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  // Negative index
  act(() => {
    hookInstance.scrollToIndex(-1)
  })
  assert.equal(containerEl.scrollTop, 0, 'negative index should no-op')

  // NaN index
  act(() => {
    hookInstance.scrollToIndex(NaN)
  })
  assert.equal(containerEl.scrollTop, 0, 'NaN index should no-op')

  // Infinity index
  act(() => {
    hookInstance.scrollToIndex(Infinity)
  })
  assert.equal(containerEl.scrollTop, 0, 'Infinity index should no-op')
})

test('scrollToIndex: clamps index exceeding store.count to the last item', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const items = createMockItems(25)
  render(
    <WindowHarness
      seed={{ items, total: 25, nextCursor: null }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  // Request index 999 (greater than count 25, clamps to 24)
  // For index 24 in list view: itemTop = 24 * 64 + 44 = 1580, itemBottom = 1644
  // Visible area height = 600, targetScrollTop = 1644 - 600 = 1044
  act(() => {
    hookInstance.scrollToIndex(999, { align: 'auto' })
  })
  assert.equal(containerEl.scrollTop, 1044, 'should clamp to last item index and scroll to bottom of viewport')
})

test('scrollToIndex: auto alignment preserves scrollTop if item is already in view', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const items = createMockItems(50)
  render(
    <WindowHarness
      seed={{ items, total: 50, nextCursor: null }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  containerEl.scrollTop = 0

  // Item 2 is at itemTop = 2 * 64 + 44 = 172, itemBottom = 236.
  // Visible area is 44 to 600, so item 2 is completely in view.
  act(() => {
    hookInstance.scrollToIndex(2, { align: 'auto' })
  })
  assert.equal(containerEl.scrollTop, 0, 'already-visible item should not shift scrollTop')
})

test('scrollToIndex: auto alignment scrolls down when item is below viewport', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const items = createMockItems(50)
  render(
    <WindowHarness
      seed={{ items, total: 50, nextCursor: null }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  containerEl.scrollTop = 0

  // Item 10: itemTop = 10 * 64 + 44 = 684, itemBottom = 748.
  // Viewport height = 600, so item 10 bottom is below 600.
  // Scroll down so itemBottom is flush with viewport bottom: 748 - 600 = 148.
  act(() => {
    hookInstance.scrollToIndex(10, { align: 'auto' })
  })
  assert.equal(containerEl.scrollTop, 148, 'should scroll down so item bottom aligns with viewport bottom')
})

test('scrollToIndex: auto alignment scrolls up when item is above viewport', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const items = createMockItems(50)
  render(
    <WindowHarness
      seed={{ items, total: 50, nextCursor: null }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  // Start scrolled down at 400
  containerEl.scrollTop = 400

  // Item 2: itemTop = 2 * 64 + 44 = 172.
  // Visible top = 400 + 44 = 444. Item 2 is above viewport.
  // Scroll up so item top aligns with visible top: itemTop - offset = 172 - 44 = 128.
  act(() => {
    hookInstance.scrollToIndex(2, { align: 'auto' })
  })
  assert.equal(containerEl.scrollTop, 128, 'should scroll up so item top aligns with visible top below sticky header')
})

test('scrollToIndex: explicit alignments start, end, and center', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const items = createMockItems(50)
  render(
    <WindowHarness
      seed={{ items, total: 50, nextCursor: null }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  // align: start for item 5
  // itemTop = 5 * 64 + 44 = 364. targetScrollTop = 364 - 44 = 320.
  act(() => {
    hookInstance.scrollToIndex(5, { align: 'start' })
  })
  assert.equal(containerEl.scrollTop, 320, 'align start should place item at top of content area')

  // align: end for item 5
  // itemBottom = 364 + 64 = 428. targetScrollTop = 428 - 600 = -172 -> clamped to 0.
  act(() => {
    hookInstance.scrollToIndex(5, { align: 'end' })
  })
  assert.equal(containerEl.scrollTop, 0, 'align end with short distance clamps to 0')

  // align: end for item 15
  // itemBottom = 15 * 64 + 44 + 64 = 1068. targetScrollTop = 1068 - 600 = 468.
  act(() => {
    hookInstance.scrollToIndex(15, { align: 'end' })
  })
  assert.equal(containerEl.scrollTop, 468, 'align end places item at bottom of viewport')

  // align: center for item 10
  // itemTop = 10 * 64 + 44 = 684. targetScrollTop = 684 - 44 + 32 - 300 = 640 + 32 - 300 = 372.
  act(() => {
    hookInstance.scrollToIndex(10, { align: 'center' })
  })
  assert.equal(containerEl.scrollTop, 372, 'align center centers item in viewport')
})

test('scrollToIndex: invokes element.scrollTo when behavior is smooth', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const items = createMockItems(50)
  render(
    <WindowHarness
      seed={{ items, total: 50, nextCursor: null }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  let scrollToArgs: unknown = null
  containerEl.scrollTo = (options?: ScrollToOptions | number) => {
    scrollToArgs = options
  }

  act(() => {
    hookInstance.scrollToIndex(10, { align: 'start', behavior: 'smooth' })
  })

  assert.deepEqual(
    scrollToArgs,
    { top: 640, behavior: 'smooth' },
    'should delegate to element.scrollTo with smooth behavior'
  )
})

test('scrollToIndex: handles grid view layout calculations correctly', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const items = createMockItems(50)
  render(
    <WindowHarness
      seed={{ items, total: 50, nextCursor: null }}
      view="grid"
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  // In grid view with width 1000:
  // columns = Math.max(2, Math.min(5, Math.floor((1000 - 32) / 220))) = 4 columns
  // rowHeight = 220, offset = 16
  // Item 8 is at row = Math.floor(8 / 4) = 2
  // itemTop = 2 * 220 + 16 = 456, itemBottom = 456 + 220 = 676
  // targetScrollTop for align 'end' = 676 - 600 = 76
  act(() => {
    hookInstance.scrollToIndex(8, { align: 'end' })
  })
  assert.equal(containerEl.scrollTop, 76, 'grid view should account for column count and 220px row height')
})

test('scrollToIndex: scrolling near boundary triggers batch loading when hasMore is true', async () => {
  const initialItems = createMockItems(25, 0)
  let fetchedMore = false

  // Mock global.fetch for batch fetcher
  const originalFetch = global.fetch
  global.fetch = async () => {
    fetchedMore = true
    const nextBatch = createMockItems(25, 25)
    return new Response(JSON.stringify({ items: nextBatch, total: 100, nextCursor: '50' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let hookInstance!: ReturnType<typeof useItemWindow>

    render(
      <WindowHarness
        seed={{ items: initialItems, total: 100, nextCursor: '25' }}
        onReady={(h) => {
          hookInstance = h
        }}
      />
    )

    assert.equal(hookInstance.store.count, 25)
    assert.equal(hookInstance.store.hasMore, true)

    // Scroll to item 24 (within 5 items of batch end: 24 >= 25 - 5)
    act(() => {
      hookInstance.scrollToIndex(24, { align: 'start' })
    })

    await waitFor(() => {
      assert.ok(fetchedMore, 'scrolling near batch boundary should trigger loadMore')
      assert.equal(hookInstance.store.count, 50, 'new batch should be loaded into store')
    })
  } finally {
    global.fetch = originalFetch
  }
})
