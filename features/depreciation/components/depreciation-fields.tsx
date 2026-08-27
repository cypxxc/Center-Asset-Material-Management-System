'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { FormField, FormGrid, FormInput, FormLabel, FormSection, FormSelect } from '@/components/ui/form'
import { FormattedNumberInput } from '@/components/ui/formatted-number-input'
import { calculateStraightLineDepreciation } from '../calculation'
import type { ItemDetail } from '@/features/items/types'

export function DepreciationFields({ item }: { item?: ItemDetail }) {
  const [enabled, setEnabled] = useState(item?.depreciation_enabled ?? false)
  const [cost, setCost] = useState(item?.depreciation_cost?.toString() ?? '')
  const [life, setLife] = useState(item?.depreciation_useful_life_years?.toString() ?? '')
  const [startDate, setStartDate] = useState(item?.depreciation_start_date ?? '')
  const result = calculateStraightLineDepreciation({ enabled, cost: Number(cost.replaceAll(',', '')) || null, usefulLifeYears: Number(life) || null, startDate: startDate || null })

  return (
    <FormSection title="การคิดค่าเสื่อมราคา">
      <input type="hidden" name="depreciation_enabled" value={enabled ? 'true' : 'false'} />
      <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold">คิดค่าเสื่อมแบบเส้นตรง</span>
          <span className="block text-xs text-muted-foreground">มูลค่าคงเหลือกำหนดเป็น 1 บาท</span>
        </span>
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-primary" />
      </label>
      {enabled && <>
        <FormGrid className="mt-4">
          <FormField>
            <FormLabel htmlFor="depreciation_cost" required>มูลค่าพร้อมใช้งาน</FormLabel>
            <FormattedNumberInput id="depreciation_cost" name="depreciation_cost" allowDecimals defaultValue={cost} onChange={(event) => setCost(event.target.value)} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="depreciation_useful_life_years" required>อายุการใช้งาน (ปี)</FormLabel>
            <FormInput id="depreciation_useful_life_years" name="depreciation_useful_life_years" type="number" min="1" defaultValue={life} onChange={(event) => setLife(event.target.value)} />
          </FormField>
          <FormField>
            <FormLabel htmlFor="depreciation_start_basis" required>อ้างอิงวันเริ่มคิด</FormLabel>
            <FormSelect id="depreciation_start_basis" name="depreciation_start_basis" defaultValue={item?.depreciation_start_basis ?? 'available'}>
              <option value="acquired">วันที่ได้มา</option><option value="available">วันที่พร้อมใช้งาน</option><option value="manual">กำหนดวันเอง</option>
            </FormSelect>
          </FormField>
          <FormField>
            <FormLabel htmlFor="depreciation_start_date" required>วันเริ่มคิดค่าเสื่อม</FormLabel>
            <FormInput id="depreciation_start_date" name="depreciation_start_date" type="date" defaultValue={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </FormField>
        </FormGrid>
        {result && <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><Calculator className="h-4 w-4 text-primary" /><span>ค่าเสื่อมต่อปี <strong>{result.annualDepreciation.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</strong>, มูลค่าคงเหลือ 1.00 บาท</span></div>}
      </>}
    </FormSection>
  )
}
