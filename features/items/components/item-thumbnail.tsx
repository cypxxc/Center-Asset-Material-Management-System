'use client'

import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ITEM_TYPE_LABELS, type ItemType } from '@/features/items/types'
import { cn } from '@/lib/utils'
import { typeIcons } from './item-type-icon'

export interface ItemThumbnailProps {
  imageUrl?: string | null
  itemName: string
  itemType: ItemType
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showZoom?: boolean
}

const sizeClasses = {
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-16 w-16 rounded-lg',
  lg: 'h-24 w-24 rounded-xl',
}

const emptySubscribe = () => () => {}

export function ItemThumbnail({
  imageUrl,
  itemName,
  itemType,
  size = 'sm',
  className,
  showZoom = true,
}: ItemThumbnailProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const imageError = Boolean(imageUrl && failedUrl === imageUrl)
  const [isHovered, setIsHovered] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleMouseEnter = () => {
    if (!imageUrl || imageError || !showZoom) return
    timerRef.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCoords({
          top: Math.max(10, rect.top - 40),
          left: Math.min(window.innerWidth - 180, rect.right + 12),
        })
        setIsHovered(true)
      }
    }, 250)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsHovered(false)
  }

  const hasValidImage = Boolean(imageUrl) && !imageError
  const dimensions = sizeClasses[size] || sizeClasses.sm

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden border border-border/60 bg-muted/80 shadow-2xs select-none',
          dimensions,
          className
        )}
        data-testid="item-thumbnail"
        role="img"
        aria-label={hasValidImage ? `รูปภาพ ${itemName}` : `ไอคอนประเภท ${ITEM_TYPE_LABELS[itemType]}`}
      >
        {hasValidImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl!}
            alt={itemName}
            loading="eager"
            decoding="auto"
            onError={() => setFailedUrl(imageUrl || '')}
            className="h-full w-full object-cover"
            data-testid="item-thumbnail-image"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-muted-foreground"
            data-testid="item-thumbnail-fallback"
          >
            {typeIcons[itemType]}
          </div>
        )}
      </div>

      {/* Floating Zoom Preview via React Portal */}
      {mounted && isHovered && coords && hasValidImage && typeof document !== 'undefined' && (
        createPortal(
          <div
            role="tooltip"
            data-testid="item-thumbnail-zoom-preview"
            className="fixed z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150 rounded-xl border border-border bg-card p-1.5 shadow-2xl"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl!}
              alt={itemName}
              className="h-40 w-40 object-cover rounded-lg"
            />
            <p className="mt-1 px-1 text-[11px] font-bold text-foreground truncate max-w-[160px]">
              {itemName}
            </p>
          </div>,
          document.body
        )
      )}
    </>
  )
}
