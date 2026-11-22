'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { returnDisbursement } from '@/features/disbursements/actions'

export function DueBorrowReturnAction({ disbursementId }: { disbursementId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)

  async function handleReturn() {
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setError('')
    try {
      const result = await returnDisbursement(disbursementId)
      if (!result.ok) {
        setError(result.error || 'คืนวัสดุไม่สำเร็จ กรุณาลองใหม่')
        return
      }
      router.refresh()
    } catch {
      setError('คืนวัสดุไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return <div className="flex flex-col items-center gap-1">
    <Button aria-busy={pending} type="button" size="sm" variant="outline" disabled={pending} onClick={handleReturn}>
      {pending ? 'กำลังคืน...' : 'คืน'}
    </Button>
    {error && <span role="alert" className="max-w-40 whitespace-normal text-center text-[11px] text-destructive">{error}</span>}
  </div>
}
