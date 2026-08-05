'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { softDeleteItem } from '../actions'

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((mod) => mod.ConfirmDialog),
  { ssr: false }
)

export function DeleteItemButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = () => {
    startTransition(async () => {
      const result = await softDeleteItem(id)
      if (result?.message) {
        alert(result.message)
        setShowConfirm(false)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        className="font-semibold flex items-center gap-1.5 h-10 px-4"
        onClick={() => setShowConfirm(true)}
      >
        <Trash2 className="h-4 w-4" />
        <span>{pending ? 'กำลังลบ...' : 'ลบรายการ'}</span>
      </Button>

      <ConfirmDialog
        open={showConfirm}
        title="ยืนยันการลบพัสดุ"
        description="คุณแน่ใจหรือไม่ว่าต้องการนำรายการนี้ไปยังถังขยะ?"
        confirmText="ลบรายการ"
        cancelText="ยกเลิก"
        variant="destructive"
        isPending={pending}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}

