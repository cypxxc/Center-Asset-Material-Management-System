'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { hardDeleteItem } from '../actions'
import type { ActionResponse } from '@/lib/actions-helper'

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((mod) => mod.ConfirmDialog),
  { ssr: false }
)

export function DeleteItemButton({
  id,
  deleteAction = hardDeleteItem,
}: {
  id: string
  deleteAction?: (id: string) => Promise<ActionResponse>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)
  const { toast } = useToast()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAction(id)
      if (result?.success) {
        setShowConfirm(false)
        router.refresh()
        router.push('/items')
      } else {
        toast(result?.error || result?.message || 'ไม่สามารถลบรายการได้', 'error')
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
        description="รายการและรูปภาพที่เกี่ยวข้องจะถูกลบถาวร และไม่สามารถกู้คืนจากระบบได้"
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
