'use client'

import { FormCombobox } from '@/components/ui/form-combobox'

import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { FormError, FormField, FormGrid, FormInput, FormLabel } from '@/components/ui/form'
import { FormattedNumberInput } from '@/components/ui/formatted-number-input'
import { calculateStraightLineDepreciation } from '../calculation'
import type { ItemDetail } from '@/features/items/types'

export function DepreciationFields({ item, fieldErrors }: { item?: ItemDetail; fieldErrors?: Record<string, string[] | undefined> }) {
  const [enabled, setEnabled] = useState(item?.depreciation_enabled ?? false)
  const [cost, setCost] = useState(item?.depreciation_cost?.toString() ?? '')
  const [life, setLife] = useState(item?.depreciation_useful_life_years?.toString() ?? '')
  const [startDate, setStartDate] = useState(item?.depreciation_start_date ?? '')
  const result = calculateStraightLineDepreciation({ enabled, cost: Number(cost.replaceAll(',', '')) || null, usefulLifeYears: Number(life) || null, startDate: startDate || null })
  function errorProps(name: string) {
    return { 'aria-invalid': !!fieldErrors?.[name]?.length, 'aria-describedby': fieldErrors?.[name]?.length ? `${name}-error` : undefined }
  }
  function error(name: string) {
    return fieldErrors?.[name]?.length ? <FormError id={`${name}-error`}>{fieldErrors[name]![0]}</FormError> : null
  }

  return (
    <section aria-label="การคิดค่าเสื่อมราคา" className="space-y-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><Calculator aria-hidden="true" className="h-4 w-4 text-amber-700 dark:text-amber-400" />การคิดค่าเสื่อมราคา</h3>
      <input type="hidden" name="depreciation_enabled" value={enabled ? 'true' : 'false'} />
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold">คิดค่าเสื่อมแบบเส้นตรง</span>
          <span className="block text-xs text-muted-foreground">มูลค่าคงเหลือกำหนดเป็น 1 บาท</span>
        </span>
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} {...errorProps('depreciation_enabled')} className="h-4 w-4 accent-primary" />
      </label>
      {error('depreciation_enabled')}
      {enabled && <>
        <p className="text-sm leading-relaxed text-muted-foreground">
          ค่าเสื่อมต่อปี = (มูลค่าพร้อมใช้งาน − มูลค่าคงเหลือ 1 บาท) ÷ อายุการใช้งาน (ปี)
        </p>
        <FormGrid className="mt-4">
          <FormField>
            <FormLabel htmlFor="depreciation_cost" required>มูลค่าพร้อมใช้งาน</FormLabel>
            <FormattedNumberInput id="depreciation_cost" name="depreciation_cost" allowDecimals defaultValue={cost} onChange={(event) => setCost(event.target.value)} {...errorProps('depreciation_cost')} />
            {error('depreciation_cost')}
          </FormField>
          <FormField>
            <FormLabel htmlFor="depreciation_useful_life_years" required>อายุการใช้งาน (ปี)</FormLabel>
            <FormInput id="depreciation_useful_life_years" name="depreciation_useful_life_years" type="number" min="1" defaultValue={life} onChange={(event) => setLife(event.target.value)} {...errorProps('depreciation_useful_life_years')} />
            {error('depreciation_useful_life_years')}
          </FormField>
          <FormField>
            <FormLabel htmlFor="depreciation_start_basis" required>อ้างอิงวันเริ่มคิด</FormLabel>
            <FormCombobox id="depreciation_start_basis" name="depreciation_start_basis" defaultValue={item?.depreciation_start_basis ?? 'available'} {...errorProps('depreciation_start_basis')}>
              <option value="acquired">วันที่ได้มา</option><option value="available">วันที่พร้อมใช้งาน</option><option value="manual">กำหนดวันเอง</option>
            </FormCombobox>
            {error('depreciation_start_basis')}
          </FormField>
          <FormField>
            <FormLabel htmlFor="depreciation_start_date" required>วันเริ่มคิดค่าเสื่อม</FormLabel>
            <FormInput id="depreciation_start_date" name="depreciation_start_date" type="date" defaultValue={startDate} onChange={(event) => setStartDate(event.target.value)} {...errorProps('depreciation_start_date')} />
            {error('depreciation_start_date')}
          </FormField>
        </FormGrid>
        {result && <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><Calculator className="h-4 w-4 text-primary" /><span>ค่าเสื่อมต่อปี <strong>{result.annualDepreciation.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</strong>, มูลค่าคงเหลือ 1.00 บาท</span></div>}
      </>}
    </section>
  )
}
