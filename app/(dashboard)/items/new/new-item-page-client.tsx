'use client'

import Link from 'next/link'
import { ChevronRight, PackagePlus, ArrowLeft } from 'lucide-react'
import { ItemForm } from '@/features/items/components/item-form'
import { createItem } from '@/features/items/actions'
import { ReferenceOption } from '@/features/items/types'
import { Button } from '@/components/ui/button'

interface NewItemPageClientProps {
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  units: ReferenceOption[]
  responsibleUsers?: ReferenceOption[]
}

export function NewItemPageClient({
  categories,
  locations,
  units,
  responsibleUsers,
}: NewItemPageClientProps) {
  return (
    <div className="min-h-full bg-background text-foreground pb-12">
      {/* Top Breadcrumb & Navigation Bar */}
      <div className="border-b border-border bg-card/60 backdrop-blur-xs sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6 flex items-center justify-between gap-3">
          <nav className="flex items-center gap-2 text-xs text-muted-foreground min-w-0" aria-label="Breadcrumb">
            <Link
              href="/items"
              className="hover:text-foreground transition-colors font-medium truncate flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span>ทะเบียนครุภัณฑ์และพัสดุ</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <span className="font-semibold text-foreground truncate">ขึ้นทะเบียนใหม่</span>
          </nav>

          <Link href="/items">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
              ย้อนกลับ
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Form Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 sm:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                ขึ้นทะเบียนครุภัณฑ์และพัสดุใหม่
              </h1>
            </div>
          </div>
        </div>

        <ItemForm
          action={createItem}
          categories={categories}
          locations={locations}
          units={units}
          responsibleUsers={responsibleUsers}
          showActions={true}
        />
      </main>
    </div>
  )
}
