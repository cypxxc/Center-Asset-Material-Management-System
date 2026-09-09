import '../setup/dom'
import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ImageCropDialog } from '../../components/ui/image-crop-dialog'

function mockCrop(t: TestContext, encoder: ((callback: BlobCallback, type?: string) => void) | undefined, loadError = false) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image')
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    width = 1200; height = 900
    onload?: () => void
    onerror?: () => void
    set src(_value: string) { queueMicrotask(() => loadError ? this.onerror?.() : this.onload?.()) }
  } })
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Image', original)
    else Reflect.deleteProperty(globalThis, 'Image')
  })
  const canvas = window.HTMLCanvasElement.prototype
  t.mock.method(canvas, 'getContext', () => ({
    fillRect() {}, save() {}, translate() {}, rotate() {}, scale() {}, drawImage() {}, restore() {},
  }) as unknown as CanvasRenderingContext2D)
  const originalEncoder = Object.getOwnPropertyDescriptor(canvas, 'toBlob')!
  Object.defineProperty(canvas, 'toBlob', { configurable: true, value: encoder })
  t.after(() => Object.defineProperty(canvas, 'toBlob', originalEncoder))
}

for (const mode of ['unavailable', 'null', 'empty', 'load-error'] as const) {
  test(`crop ${mode} failure shows an error and never confirms a fabricated file`, async (t) => {
    mockCrop(t, mode === 'unavailable' ? undefined : callback => callback(mode === 'empty' ? new Blob([]) : null), mode === 'load-error')
    const files: File[] = []
    render(<ImageCropDialog isOpen imageSrc="test-image" onConfirm={file => files.push(file)} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('ครอบรูปภาพ (4:3)'))
    assert.ok(await screen.findByRole('alert'))
    assert.equal(files.length, 0)
    assert.equal((screen.getByText('ครอบรูปภาพ (4:3)').closest('button') as HTMLButtonElement).disabled, false)
  })
}

test('crop keeps a nonempty JPEG fallback and names the file correctly', async (t) => {
  mockCrop(t, (callback, type) => callback(type === 'image/jpeg' ? new Blob(['encoded-image'], { type }) : null))
  const files: File[] = []
  render(<ImageCropDialog isOpen imageSrc="test-image" onConfirm={file => files.push(file)} onCancel={() => {}} />)
  fireEvent.click(screen.getByText('ครอบรูปภาพ (4:3)'))
  await waitFor(() => assert.equal(files.length, 1))
  assert.ok(files[0].size > 0)
  assert.equal(files[0].type, 'image/jpeg')
  assert.equal(files[0].name, 'cropped-item.jpg')
})

test('ImageCropDialog renders title and controls when open', () => {
  render(
    <ImageCropDialog
      isOpen={true}
      imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  )

  assert.ok(screen.getByText('ปรับแต่งและครอบรูปภาพ'))
  assert.ok(screen.getByText('ครอบรูปภาพ (4:3)'))
})

test('ImageCropDialog is null when isOpen is false', () => {
  const { container } = render(
    <ImageCropDialog
      isOpen={false}
      imageSrc={null}
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  )

  assert.equal(container.firstChild, null)
})
