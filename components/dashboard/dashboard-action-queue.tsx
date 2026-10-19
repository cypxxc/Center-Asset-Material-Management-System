import { getUrgentDamagedItems } from '@/features/items/queries'
import { getLowStockItems } from '@/features/items/queries'
import type { UrgentDamagedItem } from '@/features/items/types'
import {
  DashboardActionQueueClient,
  type FormattedLowStockItem,
} from './dashboard-action-queue-client'

export type { FormattedLowStockItem }
export { DashboardActionQueueClient }

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

export function ActionQueueSkeleton() {
  return (
    <div
      id="action-queue"
      data-testid="action-queue-skeleton"
      className="bg-card text-card-foreground p-5 sm:p-6 rounded-xl border border-border shadow-2xs flex flex-col justify-between animate-pulse"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <div className="h-5 w-52 bg-muted rounded mb-1.5" />
          <div className="h-3.5 w-72 bg-muted rounded" />
        </div>
        <div className="h-6 w-32 bg-muted rounded-full" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mt-3 mb-4 gap-2">
        <div className="h-9 w-40 bg-muted rounded-t-md" />
        <div className="h-9 w-36 bg-muted rounded-t-md" />
      </div>

      {/* 3 Skeleton rows matching live component dimensions for Zero CLS */}
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            data-testid="skeleton-row"
            className="p-3 sm:p-3.5 rounded-lg border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 w-44 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-20 bg-muted rounded-full" />
              <div className="h-8 w-16 bg-muted rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
