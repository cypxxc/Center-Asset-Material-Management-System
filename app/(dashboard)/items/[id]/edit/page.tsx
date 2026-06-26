import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateItem } from '@/features/items/actions'
import { ItemForm } from '@/features/items/components/item-form'
import { getItemById, getItemReferences } from '@/features/items/queries'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'

interface EditItemPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditItemPage({ params }: EditItemPageProps) {
  const profile = await getCurrentProfile()
  if (!canWrite(profile?.role)) {
    redirect('/items')
  }

  const { id } = await params
  const [item, references] = await Promise.all([getItemById(id), getItemReferences()])

  if (!item) notFound()


  const action = updateItem.bind(null, item.id)

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/items/${item.id}`}>
            <Button variant="outline" size="icon-sm" className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">แก้ไขข้อมูลสิ่งของ</h2>
            <p className="text-sm text-muted-foreground">{item.item_name}</p>
          </div>
        </div>

        <ItemForm
          action={action}
          item={item}
          categories={references.categories}
          locations={references.locations}
          units={references.units}
        />
      </div>
    </div>
  )
}
