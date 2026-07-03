import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
  variant?: "default" | "destructive"
  closeOnOutsideClick?: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  onConfirm,
  onCancel,
  isPending = false,
  variant = "default",
  closeOnOutsideClick = true,
}: ConfirmDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement
      // Focus the first focusable element (usually cancel button)
      setTimeout(() => {
        const focusable = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable && focusable.length > 0) {
          (focusable[0] as HTMLElement).focus()
        }
      }, 50)
    } else {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel()
      }
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable && focusable.length > 0) {
          const first = focusable[0] as HTMLElement
          const last = focusable[focusable.length - 1] as HTMLElement
          if (e.shiftKey && document.activeElement === first) {
            last.focus()
            e.preventDefault()
          } else if (!e.shiftKey && document.activeElement === last) {
            first.focus()
            e.preventDefault()
          }
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  const handleOutsideClick = () => {
    if (closeOnOutsideClick && !isPending) {
      onCancel()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleOutsideClick}
    >
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200 focus-visible:outline-none focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            variant === "destructive" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
          }`}>
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="dialog-title" className="text-base font-bold text-slate-900 leading-6">{title}</h3>
            <p id="dialog-desc" className="text-xs text-slate-600 mt-1.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2.5 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="h-9 px-4 font-semibold cursor-pointer"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending}
            className="h-9 px-4 font-bold cursor-pointer"
          >
            {isPending ? "กำลังบันทึก..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
