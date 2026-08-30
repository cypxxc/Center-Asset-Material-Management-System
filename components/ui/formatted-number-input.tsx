'use client'

import * as React from 'react'
import { FormInput } from '@/components/ui/form'
import { formatNumberWithCommas, stripCommas } from '@/lib/number-format'

export interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'value'> {
  allowDecimals?: boolean
  defaultValue?: string | number | null
  value?: string | number | null
}

export const FormattedNumberInput = React.forwardRef<
  HTMLInputElement,
  FormattedNumberInputProps
>(({ allowDecimals = false, defaultValue, value, name, onChange, ...props }, ref) => {
  const localRef = React.useRef<HTMLInputElement>(null)

  React.useImperativeHandle(ref, () => localRef.current as HTMLInputElement)

  const isControlled = value !== undefined

  const formatValue = React.useCallback(
    (val: string | number | null | undefined) => {
      return formatNumberWithCommas(val, allowDecimals)
    },
    [allowDecimals]
  )

  const [internalValue, setInternalValue] = React.useState(() =>
    formatValue(defaultValue ?? value ?? '')
  )

  const displayValue = isControlled ? formatValue(value) : internalValue

  React.useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      setInternalValue(formatValue(defaultValue))
    }
  }, [defaultValue, isControlled, formatValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const selectionStart = e.target.selectionStart ?? rawValue.length

    let validCharsBeforeCursor = 0
    let hasDot = false
    for (let i = 0; i < selectionStart; i++) {
      const char = rawValue[i]
      if (char >= '0' && char <= '9') {
        validCharsBeforeCursor++
      } else if (allowDecimals && char === '.' && !hasDot) {
        hasDot = true
        validCharsBeforeCursor++
      }
    }

    let cleaned = ''
    let dotCount = 0
    for (let i = 0; i < rawValue.length; i++) {
      const char = rawValue[i]
      if (char >= '0' && char <= '9') {
        cleaned += char
      } else if (allowDecimals && char === '.' && dotCount === 0) {
        cleaned += char
        dotCount++
      }
    }

    const formatted = formatNumberWithCommas(cleaned, allowDecimals)

    if (!isControlled) {
      setInternalValue(formatted)
    }

    let newCursorPos = formatted.length
    let count = 0
    for (let i = 0; i < formatted.length; i++) {
      if (count === validCharsBeforeCursor) {
        newCursorPos = i
        break
      }
      const char = formatted[i]
      if ((char >= '0' && char <= '9') || char === '.') {
        count++
      }
    }

    requestAnimationFrame(() => {
      if (localRef.current) {
        localRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    })

    if (onChange) {
      onChange(e)
    }
  }

  const unformattedValue = stripCommas(displayValue)

  return (
    <>
      {name && <input type="hidden" name={name} value={unformattedValue} />}
      <FormInput
        ref={localRef}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    </>
  )
})

FormattedNumberInput.displayName = 'FormattedNumberInput'
