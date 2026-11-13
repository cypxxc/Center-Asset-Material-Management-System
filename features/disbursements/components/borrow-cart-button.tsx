'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BorrowCartButton({ count, onClick, className, buttonRef }: { count: number; onClick: () => void; className?: string; buttonRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <Button ref={buttonRef} type="button" variant="outline" size="sm" onClick={onClick} className={className} aria-haspopup="dialog">
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      <span aria-live="polite">ตะกร้า ({count})</span>
    </Button>
  )
}
