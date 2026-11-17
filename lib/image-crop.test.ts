import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { chromium } from '@playwright/test'

test('crop preserves detail, avoids upscaling, and matches the contained preview', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    // tsx adds this naming helper to functions serialized into the browser.
    await page.addScriptTag({ content: 'window.__name = (value) => value' })
    const source = ts.transpileModule(readFileSync('lib/image-crop.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const result = await page.evaluate(async (code) => {
      const exports: Record<string, unknown> = {}
      new Function('exports', code)(exports)
      const render = exports.renderImageCrop as (image: HTMLImageElement, options: {
        previewWidth: number; previewHeight: number; zoom: number; rotation: number;
        offset: { x: number; y: number }
      }) => HTMLCanvasElement
      async function crop(width: number, height: number, zoom = 1, rotation = 0) {
        const input = document.createElement('canvas')
        input.width = width
        input.height = height
        const ctx = input.getContext('2d')!
        ctx.fillStyle = '#ff0000'
        ctx.fillRect(0, 0, width, height)
        const image = new Image()
        image.src = input.toDataURL()
        await image.decode()
        const output = render(image, { previewWidth: 400, previewHeight: 300,
          zoom, rotation, offset: { x: 0, y: 0 } })
        const pixel = [...output.getContext('2d')!.getImageData(0, output.height / 2, 1, 1).data]
        return { width: output.width, height: output.height, pixel }
      }
      return { large: await crop(4000, 3000), small: await crop(640, 480),
        zoomed: await crop(4000, 3000, 3), portrait: await crop(900, 1200),
        rotated: await crop(4000, 3000, 1, 90) }
    }, source)
    assert.deepEqual([result.large.width, result.large.height], [2400, 1800], 'retain detail for full-screen viewing')
    assert.deepEqual([result.small.width, result.small.height], [640, 480], 'do not enlarge small sources')
    assert.deepEqual([result.zoomed.width, result.zoomed.height], [1332, 999], 'zoom must not invent source pixels')
    assert.deepEqual(result.portrait.pixel, [255, 255, 255, 255], 'portrait keeps preview whitespace')
    assert.deepEqual(result.rotated.pixel, [255, 255, 255, 255], 'rotation matches preview')
  } finally {
    await browser.close()
  }
})
