'use client'

import dynamic from 'next/dynamic'

const AssetTagModal = dynamic(
  () => import('@/components/ui/asset-tag-modal').then((mod) => mod.AssetTagModal),
  { ssr: false }
)

export { AssetTagModal }
