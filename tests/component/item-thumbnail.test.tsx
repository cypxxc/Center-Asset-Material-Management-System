import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ItemThumbnail } from '../../features/items/components/item-thumbnail'

test('ItemThumbnail: renders image element when valid imageUrl is provided', () => {
  render(
    <ItemThumbnail
      imageUrl="https://example.com/laptop.jpg"
      itemName="Dell Latitude 5420"
      itemType="asset"
      size="sm"
    />
  )

  const img = screen.getByTestId('item-thumbnail-image') as HTMLImageElement
  assert.ok(img)
  assert.equal(img.src, 'https://example.com/laptop.jpg')
  assert.equal(img.alt, 'Dell Latitude 5420')

  const container = screen.getByTestId('item-thumbnail')
  assert.ok(container.className.includes('h-9 w-9'))
  assert.equal(container.getAttribute('aria-label'), 'รูปภาพ Dell Latitude 5420')
})

test('ItemThumbnail: renders fallback icon when imageUrl is null or empty', () => {
  const { rerender } = render(
    <ItemThumbnail
      imageUrl={null}
      itemName="กระดาษ A4"
      itemType="material"
      size="sm"
    />
  )

  assert.equal(screen.queryByTestId('item-thumbnail-image'), null)
  const fallback = screen.getByTestId('item-thumbnail-fallback')
  assert.ok(fallback)

  const container = screen.getByTestId('item-thumbnail')
  assert.equal(container.getAttribute('aria-label'), 'ไอคอนประเภท วัสดุ')

  // Check asset type fallback icon
  rerender(
    <ItemThumbnail
      imageUrl={undefined}
      itemName="โต๊ะทำงาน"
      itemType="asset"
      size="md"
    />
  )

  assert.equal(screen.queryByTestId('item-thumbnail-image'), null)
  assert.ok(screen.getByTestId('item-thumbnail-fallback'))
  assert.ok(screen.getByTestId('item-thumbnail').className.includes('h-16 w-16'))
  assert.equal(screen.getByTestId('item-thumbnail').getAttribute('aria-label'), 'ไอคอนประเภท ครุภัณฑ์')
})

test('ItemThumbnail: gracefully falls back to icon when image loading fails (onError)', () => {
  render(
    <ItemThumbnail
      imageUrl="https://broken-url.com/missing.png"
      itemName="เก้าอี้สำนักงาน"
      itemType="asset"
      size="sm"
    />
  )

  const img = screen.getByTestId('item-thumbnail-image')
  assert.ok(img)

  // Fire image loading error
  act(() => {
    fireEvent.error(img)
  })

  // Image element should be replaced by fallback icon without throwing or collapsing layout
  assert.equal(screen.queryByTestId('item-thumbnail-image'), null)
  assert.ok(screen.getByTestId('item-thumbnail-fallback'))

  const container = screen.getByTestId('item-thumbnail')
  assert.ok(container.className.includes('h-9 w-9'), 'container retains fixed dimensions')
  assert.equal(container.getAttribute('aria-label'), 'ไอคอนประเภท ครุภัณฑ์')
})

test('ItemThumbnail: supports different sizing classes', () => {
  const { rerender } = render(
    <ItemThumbnail
      imageUrl={null}
      itemName="พัสดุขนาดเล็ก"
      itemType="asset"
      size="sm"
    />
  )
  assert.ok(screen.getByTestId('item-thumbnail').className.includes('h-9 w-9'))

  rerender(
    <ItemThumbnail
      imageUrl={null}
      itemName="พัสดุขนาดกลาง"
      itemType="asset"
      size="md"
    />
  )
  assert.ok(screen.getByTestId('item-thumbnail').className.includes('h-16 w-16'))

  rerender(
    <ItemThumbnail
      imageUrl={null}
      itemName="พัสดุขนาดใหญ่"
      itemType="asset"
      size="lg"
    />
  )
  assert.ok(screen.getByTestId('item-thumbnail').className.includes('h-24 w-24'))
})

test('ItemThumbnail: hover zoom displays floating preview after delay when enabled', async () => {
  render(
    <ItemThumbnail
      imageUrl="https://example.com/asset.jpg"
      itemName="โปรเจคเตอร์ Epson"
      itemType="asset"
      size="sm"
      showZoom={true}
    />
  )

  const container = screen.getByTestId('item-thumbnail')

  // Initially zoom preview is not rendered
  assert.equal(screen.queryByTestId('item-thumbnail-zoom-preview'), null)

  // Simulate hover
  act(() => {
    fireEvent.mouseEnter(container)
  })

  // Wait for 250ms delay
  await new Promise((r) => setTimeout(r, 300))

  const preview = screen.getByTestId('item-thumbnail-zoom-preview')
  assert.ok(preview, 'zoom preview renders in portal')
  assert.ok(screen.getByText('โปรเจคเตอร์ Epson'))

  // Simulate mouse leave
  act(() => {
    fireEvent.mouseLeave(container)
  })

  assert.equal(screen.queryByTestId('item-thumbnail-zoom-preview'), null)
})

test('ItemThumbnail: does not show zoom preview when showZoom is false', async () => {
  render(
    <ItemThumbnail
      imageUrl="https://example.com/asset.jpg"
      itemName="เครื่องพิมพ์ Canon"
      itemType="asset"
      size="sm"
      showZoom={false}
    />
  )

  const container = screen.getByTestId('item-thumbnail')
  act(() => {
    fireEvent.mouseEnter(container)
  })

  await new Promise((r) => setTimeout(r, 300))

  assert.equal(screen.queryByTestId('item-thumbnail-zoom-preview'), null)
})
