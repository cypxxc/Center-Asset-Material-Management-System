'use client'

import { useState, useEffect } from 'react'
import { X, ZoomIn, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTransformedImageUrl } from '@/lib/supabase/image'

interface ZoomableImageProps {
  src: string
  alt: string
  className?: string
  imgClassName?: string
}

export function ZoomableImage({ src, alt, className, imgClassName }: ZoomableImageProps) {
  const [isZoomed, setIsZoomed] = useState(false)

  const [prevSrc, setPrevSrc] = useState(src)
  const [imgSrc, setImgSrc] = useState(() => getTransformedImageUrl(src))
  const [hasImgError, setHasImgError] = useState(false)

  const [zoomImgSrc, setZoomImgSrc] = useState(() => getTransformedImageUrl(src, { width: 1200 }))
  const [hasZoomImgError, setHasZoomImgError] = useState(false)

  // Reset state during render when prop `src` changes
  if (prevSrc !== src) {
    setPrevSrc(src)
    setImgSrc(getTransformedImageUrl(src))
    setHasImgError(false)
    setZoomImgSrc(getTransformedImageUrl(src, { width: 1200 }))
    setHasZoomImgError(false)
  }

  const handleImgError = () => {
    if (imgSrc !== src) {
      setImgSrc(src)
    } else {
      setHasImgError(true)
    }
  }

  const handleZoomImgError = () => {
    if (zoomImgSrc !== src) {
      setZoomImgSrc(src)
    } else {
      setHasZoomImgError(true)
    }
  }

  // Handle ESC key to close zoom
  useEffect(() => {
    if (!isZoomed) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isZoomed])

  return (
    <>
      <button 
        type="button"
        onClick={() => setIsZoomed(true)}
        className={cn(
          "relative group overflow-hidden cursor-zoom-in active:scale-[0.98] transition-transform block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg", 
          className
        )}
        title="เลือกเพื่อขยายรูปภาพ"
        aria-label={`ขยายรูปภาพ: ${alt}`}
      >
        {hasImgError ? (
          <div className={cn("w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 p-4 rounded-lg", imgClassName)}>
            <ImageIcon className="h-6 w-6 mb-1 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">ไม่สามารถโหลดรูปภาพได้</span>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={alt}
              loading="lazy"
              decoding="async"
              onError={handleImgError}
              className={cn("w-full h-full object-cover transition-transform group-hover:scale-105 duration-300", imgClassName)}
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="bg-black/50 backdrop-blur-sm p-2 rounded-full text-white scale-90 group-hover:scale-100 transition-all duration-200">
                <ZoomIn className="h-4 w-4" />
              </div>
            </div>
          </>
        )}
      </button>

      {/* Fullscreen Overlay */}
      {isZoomed && (
        <div 
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-8 backdrop-blur-sm select-none animate-in fade-in duration-200"
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsZoomed(false)
            }}
            className="absolute top-4 right-4 z-50 rounded-full bg-black/40 p-2.5 text-white/80 hover:bg-black/60 hover:text-white transition-all cursor-pointer border border-white/10"
            type="button"
            title="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>

          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 duration-200"
          >
            {hasZoomImgError ? (
              <div className="w-[300px] h-[200px] flex flex-col items-center justify-center bg-slate-800 text-slate-400 rounded-lg p-4 border border-white/15">
                <ImageIcon className="h-10 w-10 mb-2 text-slate-400" />
                <span className="text-sm text-slate-300 font-medium">ไม่สามารถโหลดรูปภาพได้</span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={zoomImgSrc}
                alt={alt}
                loading="lazy"
                decoding="async"
                onError={handleZoomImgError}
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/15 select-none"
              />
            )}
            
            <div className="absolute bottom-[-32px] left-0 right-0 text-center text-xs font-medium text-slate-300 truncate px-4">
              {alt}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
