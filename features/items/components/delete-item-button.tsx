'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { softDeleteItem } from '../actions'

export function DeleteItemButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      className="font-semibold flex items-center gap-1.5 h-10 px-4"
      onClick={() => {
        if (!confirm('ยืนยันการลบรายการนี้แบบ Soft Delete?')) return
        startTransition(() => {
          void softDeleteItem(id)
        })
      }}
    >
      <Trash2 className="h-4 w-4" />
      <span>{pending ? 'กำลังลบ...' : 'ลบรายการ'}</span>
    </Button>
  )
}
