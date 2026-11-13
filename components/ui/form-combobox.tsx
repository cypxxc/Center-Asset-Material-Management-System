'use client'

import { Children, isValidElement, useCallback, useEffect, useId, useRef, useState, type SelectHTMLAttributes, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = Pick<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'name' | 'defaultValue' | 'required' | 'disabled' | 'className' | 'aria-invalid' | 'aria-label' | 'aria-describedby'> & { children: ReactNode }

/** Search labels while submitting only a value from the supplied option list. */
export function FormCombobox({ children, defaultValue, required, disabled, className, name, ...inputProps }: Props) {
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>(child)) return []
    return [{ value: String(child.props.value ?? ''), label: Children.toArray(child.props.children).join(''), disabled: child.props.disabled }]
  })
  const initialValue = String(defaultValue ?? options[0]?.value ?? '')
  const [value, setValue] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const attachAnchor = useCallback((node: HTMLDivElement | null) => {
    anchor.current = node
    // Native modal dialogs live above body portals in the browser's top layer.
    setPortalContainer(node?.closest('dialog') ?? null)
  }, [])
  const listId = useId()
  const selected = options.find(option => option.value === value)
  const matches = options.filter(option => !option.disabled && option.label.normalize('NFC').toLocaleLowerCase('th').includes(query.trim().normalize('NFC').toLocaleLowerCase('th')))

  useEffect(() => {
    input.current?.setCustomValidity(required && !value ? 'กรุณาเลือกข้อมูลจากรายการ' : '')
  }, [required, value])

  useEffect(() => {
    const form = input.current?.form
    function reset() { setValue(initialValue); setQuery(''); setOpen(false); setActive(-1) }
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [initialValue])

  function show() { setQuery(''); setActive(-1); setOpen(true) }
  function choose(next: string) { setValue(next); setOpen(false); setActive(-1) }

  return <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
    <input type="hidden" name={name} value={value} disabled={disabled} />
    <Popover.Anchor asChild><div ref={attachAnchor} className="relative min-w-0">
      <input
        {...inputProps}
        ref={input}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !disabled}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-required={required}
        disabled={disabled}
        autoComplete="off"
        value={open ? query : selected?.label ?? ''}
        placeholder={open ? 'พิมพ์ค้นหา...' : 'เลือกหรือค้นหา'}
        onFocus={show}
        onClick={() => { if (!open) show() }}
        onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true) }}
        onBlur={() => { setOpen(false); setActive(-1) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) { show(); return }
            if (!matches.length) return
            const next = event.key === 'ArrowDown' ? (active + 1) % matches.length : active <= 0 ? matches.length - 1 : active - 1
            setActive(next)
            document.getElementById(`${listId}-${next}`)?.scrollIntoView?.({ block: 'nearest' })
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            if (matches[active]) choose(matches[active].value)
          } else if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
            setActive(-1)
          } else if (event.key === 'Tab') setOpen(false)
        }}
        className={cn('h-9 w-full rounded-lg border border-input bg-card pl-3 pr-9 text-xs text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive', className)}
      />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div></Popover.Anchor>
    <Popover.Portal container={portalContainer}><Popover.Content
      align="start" sideOffset={6} collisionPadding={8}
      onOpenAutoFocus={event => event.preventDefault()}
      onCloseAutoFocus={event => event.preventDefault()}
      onInteractOutside={event => { if (event.target instanceof Node && anchor.current?.contains(event.target)) event.preventDefault() }}
      className="z-[70] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
    >
      <ul id={listId} role="listbox" aria-label={inputProps['aria-label'] ?? 'ตัวเลือก'} className="max-h-[min(20rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain p-1">
        {matches.map((option, index) => <li
          id={`${listId}-${index}`} key={option.value} role="option" aria-selected={option.value === value}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(option.value)}
          className={cn('flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-muted', index === active && 'bg-muted', option.value === value && 'bg-primary/10 font-bold text-primary')}
        ><span className="min-w-0 break-words">{option.label}</span>{option.value === value && <Check aria-hidden="true" className="size-3.5 shrink-0" />}</li>)}
      </ul>
      {!matches.length && <p role="status" className="px-3 py-4 text-center text-xs text-muted-foreground">ไม่พบตัวเลือกที่ค้นหา</p>}
    </Popover.Content></Popover.Portal>
  </Popover.Root>
}
