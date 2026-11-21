import '../../../tests/setup/dom'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { act, render, cleanup } from '@testing-library/react'
import { useCartFlight } from './cart-flight-engine'

test('cart flight respects reduced motion and cleans up on arrival', async () => {
  const originalMatchMedia = window.matchMedia
  const originalAnimate = HTMLElement.prototype.animate
  let animations = 0
  let finish: (() => void) | undefined
  window.matchMedia = ((query: string) => ({ ...originalMatchMedia(query), matches: true })) as typeof window.matchMedia
  HTMLElement.prototype.animate = (() => {
    animations++
    return {
      addEventListener: (_event: string, callback: () => void) => { finish = callback },
      cancel() {},
    } as unknown as Animation
  }) as typeof HTMLElement.prototype.animate
  let trigger: ReturnType<typeof useCartFlight>['triggerFlight']
  function Harness() {
    const { triggerFlight, cartFlightOverlay } = useCartFlight()
    trigger = triggerFlight
    return cartFlightOverlay
  }
  try {
    render(<Harness />)
    const from = document.createElement('div')
    const to = document.createElement('button')
    await act(async () => { trigger(from, to) })
    assert.equal(animations, 0, 'default respects reduced motion')
    let explicitArrivals = 0
    await act(async () => { trigger(from, to, { motion: 'full', onArrive: () => { explicitArrivals++ } }) })
    assert.equal(animations, 1, 'explicitly requested cart animation also works with reduced motion enabled')
    assert.ok(document.querySelector('.lucide-package'))
    await act(async () => { finish?.() })
    assert.equal(explicitArrivals, 1)
    assert.equal(document.querySelector('.lucide-package'), null)
    window.matchMedia = ((query: string) => ({ ...originalMatchMedia(query), matches: false })) as typeof window.matchMedia
    let arrived = 0
    await act(async () => { trigger(from, to, { onArrive: () => { arrived++ } }) })
    assert.equal(animations, 2, 'cart effect starts a Web Animation')
    assert.ok(document.querySelector('.lucide-package'))
    await act(async () => { finish?.() })
    assert.equal(arrived, 1)
    assert.equal(document.querySelector('.lucide-package'), null)
  } finally {
    cleanup()
    window.matchMedia = originalMatchMedia
    HTMLElement.prototype.animate = originalAnimate
  }
})
