import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen } from '@testing-library/react'
import { ImageCropDialog } from './image-crop-dialog'

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
