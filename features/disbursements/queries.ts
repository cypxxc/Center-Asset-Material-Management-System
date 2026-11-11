import 'server-only'
import { getPostgresDisbursements, getPostgresDisbursementById, getPostgresDisbursementSelectableItems, getPostgresCentralAvailableItems, type CentralAvailableItem } from './postgres-queries'
import type { DisbursementRow, DisbursementItemRow, DisbursementListResult, DisbursementSelectableItem } from './types'

export type { CentralAvailableItem }

export async function getDisbursements(paramsInput: unknown = {}): Promise<DisbursementListResult> {
  return getPostgresDisbursements(paramsInput)
}

export async function getDisbursementById(id: string): Promise<(DisbursementRow & { items: DisbursementItemRow[] }) | null> {
  return getPostgresDisbursementById(id)
}

export async function getDisbursementSelectableItems(): Promise<DisbursementSelectableItem[]> {
  return getPostgresDisbursementSelectableItems()
}

export async function getCentralAvailableItems(): Promise<CentralAvailableItem[]> {
  return getPostgresCentralAvailableItems()
}
