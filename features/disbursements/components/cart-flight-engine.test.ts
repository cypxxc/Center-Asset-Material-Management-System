import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  getCentersFromRects,
  calculateCartArcKeyframes,
} from './cart-flight-calc'

describe('cart-flight-engine', () => {
  it('correctly calculates center coordinates and deltas from DOMRects', () => {
    const cardRect = { left: 100, top: 200, width: 200, height: 100 }
    const cartRect = { left: 800, top: 600, width: 60, height: 60 }

    const { start, target, dx, dy } = getCentersFromRects(cardRect, cartRect)

    assert.strictEqual(start.x, 200) // 100 + 100
    assert.strictEqual(start.y, 250) // 200 + 50
    assert.strictEqual(target.x, 830) // 800 + 30
    assert.strictEqual(target.y, 630) // 600 + 30
    assert.strictEqual(dx, 630)
    assert.strictEqual(dy, 380)
  })

  it('flies above the direct path and lands at the cart center for either direction', () => {
    for (const [dx, dy] of [[400, 200], [-300, -150], [0, 0]]) {
      const frames = calculateCartArcKeyframes(dx, dy)
      const end = frames.at(-1)!
      assert.strictEqual(frames[0].opacity, 1)
      assert.strictEqual(end.opacity, 0)
      const target = String(end.transform).match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/)
      assert.ok(target)
      assert.strictEqual(Number(target[1]), dx)
      assert.strictEqual(Number(target[2]), dy)
      const midpoint = String(frames[10].transform).match(/translate3d\(([-\d.]+)px, ([-\d.]+)px/)
      assert.ok(midpoint)
      assert.ok(Number(midpoint[2]) < dy / 2)
      assert.ok(frames.every(frame => !('clipPath' in frame) && !String(frame.transform).includes('rotate')))
    }
  })
})
