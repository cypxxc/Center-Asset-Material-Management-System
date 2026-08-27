export type DepreciationStartBasis = 'acquired' | 'available' | 'manual'

export interface DepreciationInput {
  enabled: boolean
  cost: number | null
  usefulLifeYears: number | null
  startDate: string | null
  residualValue?: number
}

export interface DepreciationResult {
  annualDepreciation: number
  accumulatedDepreciation: number
  netBookValue: number
  residualValue: number
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function calculateStraightLineDepreciation(
  input: DepreciationInput,
  asOf = new Date(),
): DepreciationResult | null {
  if (!input.enabled || !input.cost || !input.usefulLifeYears || !input.startDate) return null
  const residualValue = input.residualValue ?? 1
  if (input.cost <= residualValue || input.usefulLifeYears <= 0) return null

  const start = new Date(`${input.startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const annualDepreciation = roundMoney((input.cost - residualValue) / input.usefulLifeYears)
  const elapsedDays = Math.max(0, (asOf.getTime() - start.getTime()) / 86_400_000)
  const accumulatedDepreciation = roundMoney(Math.min(input.cost - residualValue, annualDepreciation * (elapsedDays / 365)))
  return {
    annualDepreciation,
    accumulatedDepreciation,
    netBookValue: roundMoney(Math.max(residualValue, input.cost - accumulatedDepreciation)),
    residualValue,
  }
}
