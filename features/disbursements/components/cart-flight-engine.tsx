'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Package } from 'lucide-react'
import {
  getCentersFromRects,
  calculateCartArcKeyframes,
  isReducedMotionPreferred,
} from './cart-flight-calc'

export interface Projectile {
  id: string
  startX: number
  startY: number
  dx: number
  dy: number
  width: number
  height: number
  imageUrl?: string | null
  motion?: 'system' | 'full'
  onArrive?: () => void
}

interface ProjectileElementProps {
  projectile: Projectile
  onFinish: (id: string) => void
}

function ProjectileElement({ projectile, onFinish }: ProjectileElementProps) {
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const keyframes = calculateCartArcKeyframes(projectile.dx, projectile.dy)
    if (typeof el.animate !== 'function' || (projectile.motion !== 'full' && isReducedMotionPreferred())) {
      projectile.onArrive?.()
      onFinish(projectile.id)
      return
    }
    const animation = el.animate(keyframes, {
      duration: 750,
      easing: 'linear',
      fill: 'forwards',
    })

    const handleFinish = () => {
      projectile.onArrive?.()
      onFinish(projectile.id)
    }

    animation.addEventListener('finish', handleFinish, { once: true })

    return () => {
      animation.cancel()
    }
  }, [projectile, onFinish])

  return (
    <div
      ref={elRef}
      style={{
        position: 'fixed',
        left: projectile.startX - projectile.width / 2,
        top: projectile.startY - projectile.height / 2,
        width: projectile.width,
        height: projectile.height,
        pointerEvents: 'none',
        zIndex: 60,
      }}
      className="select-none"
      aria-hidden="true"
    >
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-primary/20 bg-card text-primary shadow-md">
        {projectile.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={projectile.imageUrl} alt="" className="h-full w-full rounded-xl object-cover" />
        ) : <Package className="h-7 w-7" />}
      </div>
    </div>
  )
}

export function useCartFlight() {
  const [projectiles, setProjectiles] = useState<Projectile[]>([])

  const handleFinish = useCallback((id: string) => {
    setProjectiles((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const triggerFlight = useCallback(
    (
      from: HTMLElement | DOMRect,
      to: HTMLElement | DOMRect,
      options?: { onArrive?: () => void; imageUrl?: string | null; motion?: 'system' | 'full' }
    ) => {
      const fromRect = from instanceof HTMLElement ? from.getBoundingClientRect() : from
      const toRect = to instanceof HTMLElement ? to.getBoundingClientRect() : to

      // Follow the system preference unless this interaction explicitly opts in.
      if (options?.motion !== 'full' && isReducedMotionPreferred()) {
        options?.onArrive?.()
        return
      }

      const { start, dx, dy } = getCentersFromRects(fromRect, toRect)
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      const newProjectile: Projectile = {
        id,
        startX: start.x,
        startY: start.y,
        dx,
        dy,
        width: 64,
        height: 64,
        imageUrl: options?.imageUrl,
        motion: options?.motion,
        onArrive: options?.onArrive,
      }

      setProjectiles((prev) => [...prev.slice(-4), newProjectile]) // Keep max 5 concurrent
    },
    []
  )

  const cartFlightOverlay = projectiles.length > 0 ? createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {projectiles.map(projectile => (
        <ProjectileElement key={projectile.id} projectile={projectile} onFinish={handleFinish} />
      ))}
    </div>,
    document.body
  ) : null

  return { triggerFlight, cartFlightOverlay }
}
