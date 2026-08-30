'use client'

import { useState } from 'react'
import { FormField, FormInput, FormLabel, FormSelect } from '@/components/ui/form'
import { AssetNumberTemplate } from '../types'
import { renderAssetNumber } from '../format'

export function AssetNumberFields({ templates, defaultValue }: { templates: AssetNumberTemplate[]; defaultValue?: string | null }) {
  const [useTemplate, setUseTemplate] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [assetNo, setAssetNo] = useState(defaultValue ?? '')
  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const template = templates.find((value) => value.id === id)
    setAssetNo(template ? renderAssetNumber(template, {}) : '')
  }

  return <div className="space-y-3 sm:col-span-2">
    <input type="hidden" name="asset_number_mode" value={useTemplate ? 'template' : 'manual'} />
    <input type="hidden" name="asset_number_template_id" value={templateId} />
    <input type="hidden" name="asset_number_payload" value="{}" />
    <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-sm font-semibold">เลขครุภัณฑ์</p><p className="mt-0.5 text-xs text-muted-foreground">เลือกแม่แบบเพื่อเติมเลขตั้งต้น แล้วแก้ไขเลขจริงก่อนบันทึกได้ทันที</p>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={useTemplate} onChange={(event) => setUseTemplate(event.target.checked)} /> ใช้แม่แบบเลขครุภัณฑ์</label>
    </div>
    {useTemplate && <FormField><FormLabel htmlFor="asset_number_template_id_select">แม่แบบ</FormLabel><FormSelect id="asset_number_template_id_select" value={templateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">เลือกแม่แบบ</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</FormSelect></FormField>}
    <FormField><FormLabel htmlFor="asset_no">{useTemplate ? 'Preview และเลขที่จะบันทึก' : 'เลขครุภัณฑ์'}</FormLabel><FormInput id="asset_no" name="asset_no" value={assetNo} onChange={(event) => setAssetNo(event.target.value)} dir="auto" placeholder="ระบุเลขครุภัณฑ์" />{useTemplate && <p className="text-xs text-muted-foreground">แก้ไขช่องนี้ได้โดยตรง ระบบจะบันทึกค่าที่แสดงอยู่</p>}</FormField>
  </div>
}
