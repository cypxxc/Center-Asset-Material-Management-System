import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { useEffect, useRef } from 'react'
import { render, act, waitFor } from '@testing-library/react'
import { useItemWindow } from '../../features/items/use-item-window'
import { takeItemWindow } from '../../features/items/batch-window'
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
        <div key={item?.id ?? `slot-${hook.startIndex + idx}`} style={{ height: hook.view === 'list' ? 64 : 220 }}>
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

test('continuous scrolling: multiple batch loading maintains stable slots without thrashing or duplicate requests', async () => {
  const fetchCalls: string[] = []
  const originalFetch = global.fetch

  global.fetch = async (input) => {
    const url = new URL(String(input), 'http://localhost')
    const cursor = url.searchParams.get('cursor') ?? '0'
    fetchCalls.push(cursor)
    const start = Number(cursor)
    const nextCursor = start + 25 < 100 ? String(start + 25) : null
    const nextBatch = createMockItems(25, start)
    return new Response(JSON.stringify({ items: nextBatch, total: 100, nextCursor }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let hookInstance!: ReturnType<typeof useItemWindow>

    const initialItems = createMockItems(25, 0)
    render(
      <WindowHarness
        seed={{ items: initialItems, total: 100, nextCursor: '25' }}
        onReady={(h) => {
          hookInstance = h
        }}
      />
    )

    // Initial state: 25 items loaded
    assert.equal(hookInstance.store.count, 25)
    assert.equal(hookInstance.startIndex, 0)

    // 1. Scroll near end of Batch 1 (item 23)
    act(() => {
      hookInstance.scrollToIndex(23, { align: 'start' })
    })

    await waitFor(() => {
      assert.equal(hookInstance.store.count, 50, 'Batch 2 (count 50) loaded')
    })
    assert.deepEqual(fetchCalls, ['25'], 'only cursor 25 was requested once')

    // 2. Scroll near end of Batch 2 (item 47)
    act(() => {
      hookInstance.scrollToIndex(47, { align: 'start' })
    })

    await waitFor(() => {
      assert.equal(hookInstance.store.count, 75, 'Batch 3 (count 75) loaded')
    })
    assert.deepEqual(fetchCalls, ['25', '50'], 'cursor 50 requested once without repeating cursor 25')

    // 3. Scroll near end of Batch 3 (item 72)
    act(() => {
      hookInstance.scrollToIndex(72, { align: 'start' })
    })

    await waitFor(() => {
      assert.equal(hookInstance.store.count, 100, 'Batch 4 (count 100) loaded')
    })
    assert.deepEqual(fetchCalls, ['25', '50', '75'], 'all batches requested in sequence')
    assert.equal(hookInstance.store.hasMore, false, 'hasMore is now false at end of dataset')

    // 4. Verify scrolling past count does not trigger additional fetch
    act(() => {
      hookInstance.scrollToIndex(99, { align: 'start' })
    })

    // Assert fetch calls count did not increase
    assert.deepEqual(fetchCalls, ['25', '50', '75'], 'no duplicate or extra requests when hasMore is false')
    assert.ok(hookInstance.startIndex >= 0, 'startIndex is valid non-negative number')
  } finally {
    global.fetch = originalFetch
  }
})

test('virtual window height stability: totalCount reserves full height from initial mount preventing layout shift', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>

  const initialItems = createMockItems(25, 0)
  render(
    <WindowHarness
      seed={{ items: initialItems, total: 143, nextCursor: '25' }}
      onReady={(h) => {
        hookInstance = h
      }}
    />
  )

  // With 143 items at 64px row height:
  // topSpace + (slots.length * 64) + bottomSpace MUST equal 143 * 64 = 9152px
  const totalVirtualHeight = hookInstance.topSpace + (hookInstance.slots.length * 64) + hookInstance.bottomSpace
  assert.equal(totalVirtualHeight, 143 * 64, 'total virtual height matches totalCount * rowHeight without scroll jumps')
  assert.ok(hookInstance.slots.length > 0, 'slots array is populated')
  assert.equal(hookInstance.slots[0]?.id, 'item-0', 'first slot is item-0')
})

test('fast scroll ahead of loaded batches: maintains placeholder slots without collapsing to empty array', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const initialItems = createMockItems(25, 0)
  render(
    <WindowHarness
      seed={{ items: initialItems, total: 143, nextCursor: '25' }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  // Simulate scrolling fast ahead to scrollTop 3000px (item index ~46, well ahead of initial 25 items)
  act(() => {
    containerEl.scrollTop = 3000
    const win = containerEl.ownerDocument.defaultView ?? window
    containerEl.dispatchEvent(new win.Event('scroll'))
  })

  // Assert slots does not collapse to 0 length; it must render placeholder slots for the virtual window
  assert.ok(hookInstance.slots.length > 0, 'slots array must remain populated with placeholders')
  assert.ok(hookInstance.topSpace > 0, 'topSpace is appropriately calculated for the scrolled position')
  const totalVirtualHeight = hookInstance.topSpace + (hookInstance.slots.length * 64) + hookInstance.bottomSpace
  assert.equal(totalVirtualHeight, 143 * 64, 'virtual height remains stable during fast scroll ahead')
})

test('store.refresh preserves downstream and earlier resident batches without eviction flickering', async () => {
  const originalFetch = global.fetch
  global.fetch = async (input) => {
    const url = new URL(String(input), 'http://localhost')
    const cursor = url.searchParams.get('cursor') ?? '0'
    const start = Number(cursor)
    const nextCursor = start + 25 < 75 ? String(start + 25) : null
    const nextBatch = createMockItems(25, start)
    return new Response(JSON.stringify({ items: nextBatch, total: 75, nextCursor }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let hookInstance!: ReturnType<typeof useItemWindow>
    const initialItems = createMockItems(25, 0)
    render(
      <WindowHarness
        seed={{ items: initialItems, total: 75, nextCursor: '25' }}
        onReady={(h) => {
          hookInstance = h
        }}
      />
    )

    // Load batches 1 and 2
    act(() => {
      hookInstance.scrollToIndex(30, { align: 'start' })
    })
    await waitFor(() => {
      assert.equal(hookInstance.store.count, 50)
    })
    act(() => {
      hookInstance.scrollToIndex(60, { align: 'start' })
    })
    await waitFor(() => {
      assert.equal(hookInstance.store.count, 75)
    })

    // Now call store.refresh with anchor at 0
    await act(async () => {
      await hookInstance.store.refresh(75)
    })

    // Verify all 3 batches remain loaded (count remains 75, item 60 is not lost)
    assert.equal(hookInstance.store.count, 75, 'downstream batches must not be discarded during refresh')
    assert.equal(hookInstance.store.at(10)?.id, 'item-10', 'batch 0 item remains resident')
    assert.equal(hookInstance.store.at(30)?.id, 'item-30', 'batch 1 item remains resident')
    assert.equal(hookInstance.store.at(60)?.id, 'item-60', 'batch 2 item remains resident')
  } finally {
    global.fetch = originalFetch
  }
})

test('scrolling to the end of dataset never collapses slots to 1 row', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const initialItems = createMockItems(25, 0)
  render(
    <WindowHarness
      seed={{ items: initialItems, total: 70, nextCursor: '25' }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  // Scroll to bottom (scrollTop 4500px)
  act(() => {
    containerEl.scrollTop = 4500
    const win = containerEl.ownerDocument.defaultView ?? window
    containerEl.dispatchEvent(new win.Event('scroll'))
  })

  // Slots must not collapse to 1; it should render full window capacity
  assert.ok(hookInstance.slots.length >= 10, `slots length (${hookInstance.slots.length}) must maintain window capacity, never collapse to 1`)
  const totalVirtualHeight = hookInstance.topSpace + (hookInstance.slots.length * 64) + hookInstance.bottomSpace
  assert.equal(totalVirtualHeight, 70 * 64, 'virtual height remains exactly 70 * 64')
})

test('save callback identity remains stable across anchor changes to prevent row memo bailout', () => {
  let hookInstance!: ReturnType<typeof useItemWindow>
  let containerEl!: HTMLDivElement

  const initialItems = createMockItems(25, 0)
  render(
    <WindowHarness
      seed={{ items: initialItems, total: 100, nextCursor: '25' }}
      onReady={(h, el) => {
        hookInstance = h
        containerEl = el
      }}
    />
  )

  const initialSave = hookInstance.save

  // Scroll down to change anchor from 0 to 5
  act(() => {
    containerEl.scrollTop = 44 + 5 * 64 // anchor = 5
    const win = containerEl.ownerDocument.defaultView ?? window
    containerEl.dispatchEvent(new win.Event('scroll'))
  })

  // The save callback reference must be completely stable to avoid invalidating ItemTableRow React.memo
  assert.equal(hookInstance.save, initialSave, 'save callback identity must remain stable across scroll anchor changes')

  // Verify that calling the stable save callback captures the latest anchor
  hookInstance.save()
  const saved = takeItemWindow('test-scroll-session')
  assert.ok(saved, 'snapshot should be saved')
  assert.equal(saved.anchor, 5, 'snapshot must capture the latest anchor even with stable callback')
})

test('server revalidation with new seed reference refreshes window around anchor without slot collapse or nulling', async () => {
  const originalFetch = global.fetch
  global.fetch = async (input) => {
    const url = new URL(String(input), 'http://localhost')
    const cursor = url.searchParams.get('cursor') ?? '0'
    const start = Number(cursor)
    const nextBatch = createMockItems(25, start)
    return new Response(JSON.stringify({ items: nextBatch, total: 100, nextCursor: String(start + 25) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let hookInstance!: ReturnType<typeof useItemWindow>
    const initialItems = createMockItems(25, 0)

    const { rerender } = render(
      <WindowHarness
        seed={{ items: initialItems, total: 100, nextCursor: '25' }}
        onReady={(h) => {
          hookInstance = h
        }}
      />
    )

    // Load batch 1
    act(() => {
      hookInstance.scrollToIndex(30, { align: 'start' })
    })
    await waitFor(() => {
      assert.equal(hookInstance.store.count, 50)
    })

    // Simulate RSC revalidation passing updated seed reference
    const updatedItems = createMockItems(25, 0)
    rerender(
      <WindowHarness
        seed={{ items: updatedItems, total: 100, nextCursor: '25' }}
        onReady={(h) => {
          hookInstance = h
        }}
      />
    )

    await waitFor(() => {
      // Must not collapse or have null slots
      assert.ok(hookInstance.slots.length > 0)
      for (const slot of hookInstance.slots) {
        assert.notEqual(slot, null, 'slots must not become null during server revalidation')
      }
    })
  } finally {
    global.fetch = originalFetch
  }
})

test('refresh deduplication only filters against preceding batches, never against downstream batches', async () => {
  const originalFetch = global.fetch
  global.fetch = async (input) => {
    const url = new URL(String(input), 'http://localhost')
    const cursor = url.searchParams.get('cursor') ?? '0'
    const start = Number(cursor)
    // Return items that overlap with stale downstream batch 1
    const nextBatch = createMockItems(25, start)
    return new Response(JSON.stringify({ items: nextBatch, total: 75, nextCursor: '50' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let hookInstance!: ReturnType<typeof useItemWindow>
    const initialItems = createMockItems(25, 0)
    render(
      <WindowHarness
        seed={{ items: initialItems, total: 75, nextCursor: '25' }}
        onReady={(h) => {
          hookInstance = h
        }}
      />
    )

    // Load batch 1
    act(() => {
      hookInstance.scrollToIndex(30, { align: 'start' })
    })
    await waitFor(() => {
      assert.equal(hookInstance.store.count, 50)
    })

    // Now refresh batch 0
    await act(async () => {
      await hookInstance.store.refresh(75)
    })

    // Verify batch 0 items are not nulled out by downstream batch 1 items
    for (let i = 0; i < 25; i++) {
      assert.notEqual(hookInstance.store.at(i), null, `item at index ${i} must not be nulled out by downstream duplicates`)
    }
  } finally {
    global.fetch = originalFetch
  }
})
