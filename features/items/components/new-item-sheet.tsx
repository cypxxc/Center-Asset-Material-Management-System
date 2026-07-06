'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { X, Plus, Info } from 'lucide-react'
import { ItemForm } from './item-form'
import { createItemInline } from '../actions'
import { ReferenceOption } from '../types'

const NEW_ITEM_DRAFT_KEY = 'registry-s:new-item-draft'

interface NewItemSheetProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  units: ReferenceOption[]
}

function getDraftControls(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input[name], select[name], textarea[name]'
  )).filter((control) => {
    if (control instanceof HTMLInputElement) {
      return !['file', 'submit', 'button'].includes(control.type)
    }
    return true
  })
}

function readDraft(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(NEW_ITEM_DRAFT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function restoreDraft(root: ParentNode) {
  const draft = readDraft()
  for (const control of getDraftControls(root)) {
    const value = draft[control.name]
    if (value !== undefined) control.value = value
  }
}

function saveDraft(root: ParentNode) {
  const draft: Record<string, string> = {}
  for (const control of getDraftControls(root)) {
    draft[control.name] = control.value
  }
  window.localStorage.setItem(NEW_ITEM_DRAFT_KEY, JSON.stringify(draft))
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
  const [formVersion, setFormVersion] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (dialog.open) return
      dialog.showModal()
      setFormVersion((version) => version + 1)
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    restoreDraft(dialog)
  }, [open, formVersion])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return

    const handleDraftChange = () => saveDraft(dialog)
    dialog.addEventListener('input', handleDraftChange)
    dialog.addEventListener('change', handleDraftChange)

    return () => {
      dialog.removeEventListener('input', handleDraftChange)
      dialog.removeEventListener('change', handleDraftChange)
    }
  }, [open, formVersion])

  const isFormDirty = useCallback(() => {
    const dialog = dialogRef.current
    if (!dialog) return false
    const inputs = dialog.querySelectorAll('input, select, textarea')
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      if (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'number')) {
        if (input.value !== input.defaultValue) return true
      }
      if (input.tagName === 'TEXTAREA') {
        const textarea = input as HTMLTextAreaElement
        if (textarea.value !== textarea.defaultValue) return true
      }
      if (input.tagName === 'SELECT') {
        const select = input as HTMLSelectElement
        const selectedOption = select.options[select.selectedIndex]
        if (!selectedOption?.defaultSelected) return true
      }
    }
    return false
  }, [])

  const handleSuccess = useCallback(() => {
    window.localStorage.removeItem(NEW_ITEM_DRAFT_KEY)
    setFormVersion((version) => version + 1)
    onSuccess()
  }, [onSuccess])

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
            key={formVersion}
            action={createItemInline}
            categories={categories}
            locations={locations}
            units={units}
            onSuccess={handleSuccess}
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
          padding: 16px;
          border: none;
          outline: none;
          background: transparent;
          overflow: hidden;
          align-items: center;
          justify-content: center;
        }

        .new-item-sheet-dialog[open] {
          display: flex;
        }

        .new-item-sheet-dialog::backdrop {
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(2px);
        }

        .new-item-sheet-panel {
          width: 100%;
          max-width: 760px;
          max-height: min(92vh, 860px);
          background: #fff;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 80px rgba(15,23,42,0.22);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
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
