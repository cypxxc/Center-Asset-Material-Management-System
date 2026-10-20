import { getUrgentDamagedItems } from '@/features/items/queries'
import { getLowStockItems } from '@/features/items/queries'
import type { UrgentDamagedItem } from '@/features/items/types'
import {
  DashboardActionQueueClient,
  type FormattedLowStockItem,
} from './dashboard-action-queue-client'

export type { FormattedLowStockItem }

export interface DashboardActionQueueProps {
  damagedItems?: UrgentDamagedItem[]
  lowStockItems?: FormattedLowStockItem[]
}

export async function DashboardActionQueue(props: DashboardActionQueueProps = {}) {
  const [damagedItems, lowStockItems] = await Promise.all([
    props.damagedItems ? Promise.resolve(props.damagedItems) : getUrgentDamagedItems(5),
    props.lowStockItems ? Promise.resolve(props.lowStockItems) : getLowStockItems(5),
  ])

  return (
    <DashboardActionQueueClient
      damagedItems={damagedItems}
      lowStockItems={lowStockItems}
    />
  )
}

export { ActionQueueSkeleton } from './dashboard-skeletons'
