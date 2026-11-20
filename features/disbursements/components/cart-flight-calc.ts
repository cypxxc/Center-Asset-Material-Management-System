/**
 * Pure calculation and configuration helpers for the cart icon flight animation.
 */

export interface Point {
  x: number
  y: number
}

/**
 * Checks if the user prefers reduced motion.
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Calculates start and end center coordinates between two bounding client rects.
 */
export function getCentersFromRects(
  startRect: DOMRect | { left: number; top: number; width: number; height: number },
  targetRect: DOMRect | { left: number; top: number; width: number; height: number }
): { start: Point; target: Point; dx: number; dy: number } {
  const start: Point = {
    x: startRect.left + startRect.width / 2,
    y: startRect.top + startRect.height / 2,
  }
  const target: Point = {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top + targetRect.height / 2,
  }
  return {
    start,
    target,
    dx: target.x - start.x,
    dy: target.y - start.y,
  }
}

/** Generates a smooth curved flight into the cart without deforming the icon. */
export function calculateCartArcKeyframes(dx: number, dy: number, customArcLift?: number): Keyframe[] {
  const lift = customArcLift ?? Math.max(40, Math.min(110, Math.hypot(dx, dy) * 0.18))
  return Array.from({ length: 21 }, (_, index) => {
    const t = index / 20
    const x = dx * t
    const y = dy * t - 4 * lift * t * (1 - t)
    const scale = 1 - 0.65 * t
    return {
      offset: t,
      transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
      opacity: t <= 0.8 ? 1 : (1 - t) / 0.2,
    }
  })
}
