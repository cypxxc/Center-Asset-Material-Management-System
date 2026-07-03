'use client'

import { useEffect, useRef, useCallback } from 'react'
import { X, Plus, Info } from 'lucide-react'
import { ItemForm } from './item-form'
import { createItemInline } from '../actions'
import { ReferenceOption } from '../types'

interface NewItemSheetProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  units: ReferenceOption[]
}

export function NewItemSheet({
  open,
  onClose,
  onSuccess,
  categories,
  locations,
  units,
}: NewItemSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const prevOpenRef = useRef(false)

  // Handle open/close transitions
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !prevOpenRef.current) {
      dialog.showModal()
      // Small delay so the browser paints the dialog before animation kicks in
      requestAnimationFrame(() => {
        dialog.setAttribute('data-open', 'true')
      })
    } else if (!open && prevOpenRef.current) {
      dialog.removeAttribute('data-open')
      // Wait for slide-out animation to finish before actually closing
      const onTransitionEnd = () => {
        dialog.close()
        dialog.removeEventListener('transitionend', onTransitionEnd)
      }
      dialog.addEventListener('transitionend', onTransitionEnd)
    }
    prevOpenRef.current = open
  }, [open])

  const isFormDirty = useCallback(() => {
    const dialog = dialogRef.current
    if (!dialog) return false
    const inputs = dialog.querySelectorAll('input, select, textarea')
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      if (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number')) {
        if (input.value !== input.defaultValue) return true
      }
      if (input.tagName === 'SELECT') {
        if (input.value !== '') return true
      }
    }
    return false
  }, [])

  const handleCloseAttempt = useCallback(() => {
    if (isFormDirty()) {
      const confirmClose = window.confirm('คุณต้องการปิดโดยไม่บันทึกใช่หรือไม่? ข้อมูลพัสดุที่คุณพิมพ์ไว้จะสูญหาย')
      if (!confirmClose) return
    }
    onClose()
  }, [isFormDirty, onClose])

  // Close on backdrop click (outside the panel).
  // Native <dialog>: backdrop clicks have event.target === dialog element itself.
  const handleDialogClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) handleCloseAttempt()
    },
    [handleCloseAttempt]
  )

  // Close on Escape key
  const handleCancel = useCallback(
    (e: Event) => {
      e.preventDefault()
      handleCloseAttempt()
    },
    [handleCloseAttempt]
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [handleCancel])

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      className="new-item-sheet-dialog"
    >
      {/* Inner panel — slide from right */}
      <div
        className="new-item-sheet-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="new-item-sheet-header">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900">
                เพิ่มรายการสิ่งของใหม่
              </h2>
              <p className="text-[11px] text-slate-500 leading-tight">
                บันทึกสิ่งของ วัสดุ หรือครุภัณฑ์เข้าสู่ทะเบียน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseAttempt}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info banner */}
        <div className="new-item-sheet-banner">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
          <p className="text-[11px] text-blue-700 leading-relaxed">
            เลือกประเภทให้ตรงกับการใช้งานจริง — ระบบนี้เป็นทะเบียนสิ่งของ
            ไม่ใช่ระบบรับเข้า/เบิกออก
          </p>
        </div>

        {/* Scrollable form body */}
        <div className="new-item-sheet-body">
          <ItemForm
            action={createItemInline}
            categories={categories}
            locations={locations}
            units={units}
            onSuccess={onSuccess}
          />
        </div>
      </div>

      <style>{`
        .new-item-sheet-dialog {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
          margin: 0;
          padding: 0;
          border: none;
          outline: none;
          background: transparent;
          overflow: hidden;
        }

        .new-item-sheet-dialog::backdrop {
          background: rgba(15, 23, 42, 0);
          backdrop-filter: blur(0px);
          transition: background 0.3s ease, backdrop-filter 0.3s ease;
        }

        .new-item-sheet-dialog[data-open]::backdrop {
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(2px);
        }

        .new-item-sheet-panel {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: 100%;
          max-width: 560px;
          background: #fff;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 32px rgba(0,0,0,0.12);
          transform: translateX(100%);
          transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
          will-change: transform;
          border-left: 1px solid #e2e8f0;
        }

        .new-item-sheet-dialog[data-open] .new-item-sheet-panel {
          transform: translateX(0);
        }

        .new-item-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 20px 14px;
          border-bottom: 1px solid #e2e8f0;
          background: #fff;
          flex-shrink: 0;
          z-index: 1;
        }

        .new-item-sheet-banner {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 12px 20px 0;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          padding: 10px 12px;
          flex-shrink: 0;
        }

        .new-item-sheet-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px 32px;
          overscroll-behavior: contain;
        }

        /* Override ItemForm card styling inside sheet — remove double border */
        .new-item-sheet-body form {
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          background: transparent !important;
          border-radius: 0 !important;
        }
      `}</style>
    </dialog>
  )
}
