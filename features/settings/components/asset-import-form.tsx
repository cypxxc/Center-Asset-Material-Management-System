'use client'

import React, { useState } from 'react'
import { ImportUploadPanel, ImportFormatGuide, ImportResult } from './import-form-ui'
import { importItemsBulk } from '@/features/items/actions'

export function AssetImportForm({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
 const [isUploading, setIsUploading] = useState(false)
 React.useEffect(() => { onBusyChange(isUploading) }, [isUploading, onBusyChange])
 const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

 const downloadTemplate = async () => {
 try { const { downloadImportTemplate } = await import('@/features/items/import-template'); await downloadImportTemplate('asset') }
 catch { setResult({ type: 'error', message: 'Template download failed' }) }
 }

 const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
 const input = event.currentTarget
 const file = input.files?.[0]
 if (!file || isUploading) return
 setIsUploading(true)
 setResult(null)
 try {
 if (file.size > 10 * 1024 * 1024 || !/\.xlsx$/i.test(file.name)) throw new Error('กรุณาเลือกไฟล์ Excel .xlsx ขนาดไม่เกิน 10MB')
 const ExcelJS = (await import('exceljs')).default
 const { convertExcelToStandardCSV } = await import('@/features/items/excel-importer')
 const workbook = new ExcelJS.Workbook()
 await workbook.xlsx.load(await file.arrayBuffer())
 const { hasStandardTemplate, templateWorkbookCSV } = await import('@/features/items/import-template')
 const csvContent = hasStandardTemplate(workbook) ? templateWorkbookCSV(workbook) : convertExcelToStandardCSV(workbook)
 const response = await importItemsBulk(csvContent, 'asset')
 setResult({ type: response.success ? 'success' : 'error', message: response.message || (response.success ? 'นำเข้าครุภัณฑ์สำเร็จ' : 'นำเข้าครุภัณฑ์ไม่สำเร็จ') })
 } catch (error) {
 setResult({ type: 'error', message: error instanceof Error ? error.message : 'ไม่สามารถนำเข้าครุภัณฑ์ได้' })
 } finally {
 setIsUploading(false)
 input.value = ''
 }
 }

 return (
 <form aria-label="นำเข้าครุภัณฑ์" onSubmit={event => event.preventDefault()} className="space-y-6">
 <h2 className="text-base font-semibold">นำเข้าครุภัณฑ์</h2>
 <ImportUploadPanel type="asset" busy={isUploading} onDownload={downloadTemplate} onChange={handleFileChange} />

 {result && <ImportResult success={result.type === 'success'} message={result.message} />}

 <ImportFormatGuide type="asset" />
 </form>
 )
}
