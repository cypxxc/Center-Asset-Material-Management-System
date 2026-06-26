import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createItem } from '@/features/items/actions'
import { ItemForm } from '@/features/items/components/item-form'
import { getItemReferences } from '@/features/items/queries'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export default async function NewItemPage() {
  const profile = await getCurrentProfile()
  if (!canWrite(profile?.role)) {
    redirect('/items')
  }

  const references = await getItemReferences()


  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/items">
            <Button variant="outline" size="icon-sm" className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">เพิ่มรายการสิ่งของใหม่</h2>
            <p className="text-sm text-muted-foreground">บันทึกข้อมูลสิ่งของ วัสดุ หรือครุภัณฑ์ใหม่เข้าสู่ระบบทะเบียน</p>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">คำชี้แจงในการลงทะเบียน</p>
            <p className="text-xs opacity-90 mt-0.5">
              เลือกประเภทให้ตรงกับการใช้งานจริง ระบบนี้เป็นทะเบียนสิ่งของเท่านั้น ไม่ใช่ระบบรับเข้า/เบิกออกหรือ stock movement
            </p>
          </div>
        </div>

        <ItemForm
          action={createItem}
          categories={references.categories}
          locations={references.locations}
          units={references.units}
        />
      </div>
    </div>
  )
}
