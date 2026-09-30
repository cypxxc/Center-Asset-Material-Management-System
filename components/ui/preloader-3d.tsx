'use client'

import { useEffect, useRef, useState } from 'react'
import type { AnimationItem } from 'lottie-web'
import { cn } from '@/lib/utils'
import preloaderAnimation from '@/public/animations/3d-preloader.json'

interface Preloader3DProps {
  className?: string
  size?: number
  label?: string
}

export function Preloader3D({ className, size = 120, label }: Preloader3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let anim: AnimationItem | null = null

    const hasCanvasSupport =
      typeof document !== 'undefined' &&
      typeof document.createElement === 'function' &&
      Boolean(document.createElement('canvas').getContext?.('2d'))

    if (!hasCanvasSupport) return

    void import('lottie-web')
      .then((lottieModule) => {
        if (!containerRef.current) return
        try {
          const lottie = lottieModule.default || lottieModule
          anim = lottie.loadAnimation({
            container: containerRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: preloaderAnimation,
          })
          setIsLoaded(true)
        } catch {
          // Graceful fallback for non-graphical environments
          setIsLoaded(true)
        }
      })
      .catch(() => {
        setIsLoaded(true)
      })

    return () => {
      anim?.destroy()
    }
  }, [])

  const height = Math.round(size * 0.75) // 800:600 aspect ratio

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div
        ref={containerRef}
        style={{ width: `${size}px`, height: `${height}px` }}
        className={cn(
          'transition-opacity duration-300 flex items-center justify-center',
          isLoaded ? 'opacity-100' : 'opacity-30 animate-pulse'
        )}
      />
      {label && (
        <p className="mt-2 text-xs font-semibold text-muted-foreground animate-pulse">
          {label}
        </p>
      )}
    </div>
  )
}
