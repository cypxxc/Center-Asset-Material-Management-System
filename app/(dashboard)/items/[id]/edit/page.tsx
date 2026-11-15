import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateItem } from '@/features/items/actions'
import { ItemForm } from '@/features/items/components/item-form'
import { getItemEditPageData } from '@/features/items/queries'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'

interface EditItemPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditItemPage({ params }: EditItemPageProps) {
  const profilePromise = getCurrentProfile()
  const { id } = await params
  const [profile, { item, references }] = await Promise.all([
    profilePromise,
    getItemEditPageData(id),
  ])

  if (!canWrite(profile?.role)) {
    redirect('/items')
  }

  if (!item) notFound()

  const action = updateItem.bind(null, item.id)

  return (
    <div className="h-full overflow-y-auto bg-background p-4 md:p-8">
      <div className="mx-auto max-w-[800px] space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="size-10 shrink-0">
            <Link href="/items" aria-label="กลับไปทะเบียนสิ่งของ"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">แก้ไขข้อมูลสิ่งของ</h1>
            <p className="break-words text-sm text-muted-foreground">{item.item_name}</p>
          </div>
        </div>

        <ItemForm
          action={action}
          item={item}
          categories={references.categories}
          locations={references.locations}
          units={references.units}
          responsibleUsers={references.responsibleUsers}
        />
      </div>
    </div>
  )
}
