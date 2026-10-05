import type { ReactNode } from 'react'
import { Package, FileText } from 'lucide-react'
import type { ItemType } from '@/features/items/types'

export const typeIcons: Record<ItemType, ReactNode> = {
  asset: <Package className="h-4 w-4 text-blue-600" />,
  material: <FileText className="h-4 w-4 text-emerald-600" />,
}
