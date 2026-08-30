'use client'

import * as React from 'react'
import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AssetTagModal } from '@/components/ui/asset-tag-modal'
import type { ItemStickerData } from '@/components/ui/asset-tag-modal'

export interface ItemDetailActionsProps {
  item: ItemStickerData
}

export function ItemDetailActions({ item }: ItemDetailActionsProps) {
  const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsPrintModalOpen(true)}
        className="font-semibold flex items-center gap-1.5 h-10 px-4 cursor-pointer"
      >
        <Tag className="h-4 w-4" />
        <span>พิมพ์ลาเบลติดครุภัณฑ์</span>
      </Button>

      <AssetTagModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        item={item}
      />
    </>
  )
}
