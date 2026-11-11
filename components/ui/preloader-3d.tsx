'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Preloader3DProps {
  className?: string
  size?: number
  label?: string
}

export function Preloader3D({ className, label = 'กำลังโหลดข้อมูล...' }: Preloader3DProps) {
  const [progress, setProgress] = useState(12)

  useEffect(() => {
    // Simulates an organic smooth progress progression up towards 95% while waiting for page data
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev
        const remaining = 95 - prev
        const increment = Math.max(1, Math.floor(Math.random() * (remaining > 30 ? 8 : 3)) + 1)
        return Math.min(95, prev + increment)
      })
    }, 120)

    return () => clearInterval(timer)
  }, [])

  return (
    <div
      role="status"
      aria-label={`${label} ${progress}%`}
      className={cn('flex flex-col items-center justify-center p-6 text-center select-none w-full max-w-xs mx-auto', className)}
    >
      <div className="w-full space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
          <span>{label}</span>
          <span className="tabular-nums font-mono text-primary font-bold">{progress}%</span>
        </div>

        {/* Progress bar container */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted border border-border/60">
          <div
            className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
