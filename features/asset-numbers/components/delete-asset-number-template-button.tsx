'use client'

import { deleteAssetNumberTemplate } from '../actions'

export function DeleteAssetNumberTemplateButton({ id, name }: { id: string; name: string }) {
  return <form action={deleteAssetNumberTemplate.bind(null, id)} onSubmit={(event) => { if (!window.confirm(`ลบแม่แบบ “${name}” หรือไม่? รายการทะเบียนเดิมจะไม่ถูกลบ`)) event.preventDefault() }}>
    <button type="submit" className="h-9 rounded-md border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10">ลบแม่แบบ</button>
  </form>
}
