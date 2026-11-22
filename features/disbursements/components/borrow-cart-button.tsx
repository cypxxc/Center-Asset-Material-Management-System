'use client'

import { Button } from '@/components/ui/button'

export function BorrowCartButton({ count, onClick, className, buttonRef }: { count: number; onClick: () => void; className?: string; buttonRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <Button ref={buttonRef} type="button" variant="outline" size="sm" onClick={onClick} className={className} aria-haspopup="dialog">
      <span aria-live="polite">ตะกร้า ({count})</span>
    </Button>
  )
}
