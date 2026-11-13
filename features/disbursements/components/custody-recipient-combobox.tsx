'use client'

import { useId, useRef, useState } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  users: { id: string; full_name: string }[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}

export function CustodyRecipientCombobox({ users, value, onChange, disabled }: Props) {
  const listId = useId()
  const anchor = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const selectedName = users.find(user => user.id === value)?.full_name || ''
  const matches = users.filter(user => user.full_name.normalize('NFC').toLocaleLowerCase('th').includes(query.trim().normalize('NFC').toLocaleLowerCase('th')))

  function choose(id: string) {
    onChange(id)
    setOpen(false)
    setActive(-1)
  }

  function move(next: number) {
    setActive(next)
    document.getElementById(`${listId}-${next}`)?.scrollIntoView?.({ block: 'nearest' })
  }

  return <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
    <Popover.Anchor asChild><div ref={anchor} className="relative">
      <input
        id="custody-recipient"
        role="combobox"
        aria-label="ผู้ถือครอง"
        aria-required="true"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selectedName}
        placeholder={open ? 'พิมพ์ค้นหาชื่อผู้ถือครอง...' : 'เลือกหรือค้นหาผู้ถือครอง'}
        onFocus={() => { setQuery(''); setActive(-1); setOpen(true) }}
        onClick={() => { if (!open) { setQuery(''); setActive(-1); setOpen(true) } }}
        onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); onChange('') }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) { setQuery(''); setOpen(true); setActive(-1); return }
            if (matches.length) move(event.key === 'ArrowDown' ? (active + 1) % matches.length : (active <= 0 ? matches.length - 1 : active - 1))
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            if (matches[active]) choose(matches[active].id)
          } else if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
            setActive(-1)
          }
        }}
        className="h-9 w-full rounded-lg border border-input bg-background pl-3 pr-9 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div></Popover.Anchor>
    <Popover.Portal><Popover.Content
      align="start"
      sideOffset={4}
      collisionPadding={8}
      onOpenAutoFocus={event => event.preventDefault()}
      onCloseAutoFocus={event => event.preventDefault()}
      onInteractOutside={event => {
        if (event.target instanceof Node && anchor.current?.contains(event.target)) event.preventDefault()
      }}
      className="z-[70] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
    >
      <ul id={listId} role="listbox" aria-label="ผู้ถือครอง" className="max-h-[min(15rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain p-1">
        {matches.map((user, index) => <li
          id={`${listId}-${index}`}
          key={user.id}
          role="option"
          aria-selected={user.id === value}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(user.id)}
          className={cn('flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs hover:bg-muted', index === active && 'bg-muted', user.id === value && 'bg-primary/10 text-primary')}
        ><span className="min-w-0 break-words">{user.full_name}</span>{user.id === value && <Check aria-hidden="true" className="size-3.5 shrink-0" />}</li>)}
      </ul>
      {!matches.length && <p role="status" className="px-3 py-4 text-center text-xs text-muted-foreground">ไม่พบผู้ถือครอง</p>}
    </Popover.Content></Popover.Portal>
  </Popover.Root>
}
