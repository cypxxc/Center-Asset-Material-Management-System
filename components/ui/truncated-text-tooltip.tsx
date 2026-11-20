'use client'

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react'
import { Tooltip } from 'radix-ui'
import { cn } from '@/lib/utils'

export interface TruncatedTextTooltipProps extends React.HTMLAttributes<HTMLElement> {
  text: string
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  children?: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  delayDuration?: number
  showArrow?: boolean
  tooltipClassName?: string
  alwaysShow?: boolean
}

export const TruncatedTextTooltip = forwardRef<HTMLElement, TruncatedTextTooltipProps>(
  function TruncatedTextTooltip(
    {
      text,
      as: Component = 'span',
      children,
      className,
      side = 'top',
      align = 'center',
      sideOffset = 4,
      delayDuration = 150,
      showArrow = true,
      tooltipClassName,
      alwaysShow = false,
      onPointerEnter,
      onFocus,
      onKeyDown,
      tabIndex = 0,
      title: titleProp,
      ...restProps
    },
    forwardedRef
  ) {
    const [isTruncated, setIsTruncated] = useState(alwaysShow)
    const [open, setOpen] = useState(false)
    const internalRef = useRef<HTMLElement>(null)
    const resolvedTitle = titleProp ?? text

    useImperativeHandle(forwardedRef, () => internalRef.current as HTMLElement)

    const checkTruncation = (el: HTMLElement | null): boolean => {
      if (alwaysShow) {
        setIsTruncated(true)
        return true
      }
      if (!el) return false
      const truncated =
        el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1
      setIsTruncated(truncated)
      return truncated
    }

    const Tag = Component as unknown as React.ElementType

    return (
      <Tooltip.Provider delayDuration={delayDuration}>
        <Tooltip.Root
          open={open && (alwaysShow || isTruncated)}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              const truncated = checkTruncation(internalRef.current)
              if (truncated) {
                setOpen(true)
              } else {
                setOpen(false)
              }
            } else {
              setOpen(false)
            }
          }}
        >
          <Tooltip.Trigger asChild>
            <Tag
              ref={internalRef}
              tabIndex={tabIndex}
              onPointerEnter={(e: React.PointerEvent<HTMLElement>) => {
                checkTruncation(internalRef.current)
                onPointerEnter?.(e)
              }}
              onFocus={(e: React.FocusEvent<HTMLElement>) => {
                checkTruncation(internalRef.current)
                onFocus?.(e)
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.currentTarget.click()
                }
                onKeyDown?.(e)
              }}
              className={cn(
                className,
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 rounded-xs'
              )}
              title={resolvedTitle}
              {...restProps}
            >
              {children ?? text}
            </Tag>
          </Tooltip.Trigger>

          {(alwaysShow || isTruncated) && (
            <Tooltip.Portal>
              <Tooltip.Content
                side={side}
                align={align}
                sideOffset={sideOffset}
                collisionPadding={8}
                className={cn(
                  'z-[9999] max-w-xs sm:max-w-md rounded-lg border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md break-words whitespace-pre-wrap animate-in fade-in-0 zoom-in-95 pointer-events-none select-none',
                  tooltipClassName
                )}
              >
                {text}
                {showArrow && <Tooltip.Arrow className="fill-popover" />}
              </Tooltip.Content>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>
    )
  }
)

TruncatedTextTooltip.displayName = 'TruncatedTextTooltip'
