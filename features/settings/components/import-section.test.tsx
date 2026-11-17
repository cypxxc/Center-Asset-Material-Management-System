import '../../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExcelJS from 'exceljs'
Object.assign(globalThis, {
 getComputedStyle: window.getComputedStyle,
 MutationObserver: window.MutationObserver,
 CustomEvent: window.CustomEvent,
 Event: window.Event,
 NodeFilter: window.NodeFilter,
 Element: window.Element,
 Node: window.Node,
})
const calls: Array<{ csv: string; type?: string }> = []
let pendingImport: Promise<{ success: boolean; message: string }> | null = null
const actionPath=require.resolve('../../items/actions')
require.cache[actionPath]={id:actionPath,filename:actionPath,loaded:true,exports:{importItemsBulk:async(csv:string,type?:string)=>{calls.push({csv,type});return pendingImport ?? {success:true,message:'Imported'}}}} as NodeJS.Module
async function selectImportMode(mode: 'asset' | 'material') {
 fireEvent.keyDown(screen.getByRole('button',{name:'นำเข้าวัสดุ'}),{key:'ArrowDown'})
 const label=mode==='asset'?'\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32\u0e04\u0e23\u0e38\u0e20\u0e31\u0e13\u0e11\u0e4c':'\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32\u0e27\u0e31\u0e2a\u0e14\u0e38'
 fireEvent.click(await screen.findByRole('menuitemradio',{name:label}))
}

test('material import shows reading and saving feedback until the server finishes', async () => {
 const { MaterialImportForm } = await import('./material-import-form')
 const { act } = await import('@testing-library/react')
 let complete!: (result: { success: boolean; message: string }) => void
 pendingImport = new Promise(resolve => { complete = resolve })
 try {
  render(React.createElement(MaterialImportForm,{onBusyChange:()=>{}}))
  const workbook = new ExcelJS.Workbook()
  workbook.addWorksheet('วัสดุ').addRows([['ชื่อวัสดุ', 'จำนวน'], ['Loading test', 2]])
  const buffer = await workbook.xlsx.writeBuffer()
  const file=new File([buffer as BlobPart],'loading.xlsx')
  fireEvent.change(screen.getByLabelText('เลือกไฟล์วัสดุ (Excel)'),{target:{files:[file]}})
  assert.ok(screen.getByRole('status').textContent?.includes('กำลังอ่านและตรวจสอบไฟล์'))
  await waitFor(()=>assert.match(screen.getByRole('status').textContent ?? '',/กำลังบันทึกวัสดุ 1 รายการ/))
  assert.equal(calls.length,1)
  assert.equal(screen.queryByRole('button',{name:'ยืนยันนำเข้าวัสดุ'}),null)
  assert.equal(document.querySelector('input[type="file"]'),null)
  await act(async()=>complete({success:true,message:'Imported'}))
  await waitFor(()=>assert.equal(screen.queryByRole('button',{name:'กำลังนำเข้าวัสดุ…'}),null))
  assert.ok(screen.getByText('Imported'))
 } finally { pendingImport=null; calls.length=0 }
})

test('import dropdown selects two distinct forms and clears the previous one', async () => {
 const { ImportSection } = await import('./metadata-sections')
 render(React.createElement(ImportSection))
 assert.ok(screen.getByRole('heading',{name:'นำเข้าครุภัณฑ์'}))
 await selectImportMode('material')
 assert.ok(screen.getByRole('form',{name:'นำเข้าวัสดุ'}))
 assert.equal(screen.queryByRole('heading',{name:'นำเข้าครุภัณฑ์'}),null)
 assert.ok(screen.getByText(/บัญชีวัสดุรูปแบบเดิม/))
 assert.ok(screen.getByText('opening_quantity'))
 assert.ok(screen.getByText('commodity_code'))
 assert.equal(screen.queryByText('asset_no'), null)
 assert.equal(screen.queryByText('serial_no'), null)
 assert.equal(screen.queryByRole('button',{name:'ยืนยันนำเข้าวัสดุ'}),null)
 await selectImportMode('asset')
 assert.equal(screen.queryByRole('form',{name:'นำเข้าวัสดุ'}),null)
})
test('valid official material file imports automatically without confirmation', async () => {
 const { ImportSection } = await import('./metadata-sections')
 const workbook=new ExcelJS.Workbook()
 const sheet=workbook.addWorksheet('รายการวัสดุ')
 sheet.getCell('A2').value='ปีงบประมาณ พ.ศ. 2570'
 sheet.getCell('I5').value='ยอดคงเหลือยกมา';sheet.getCell('O5').value='คงเหลือ';sheet.getCell('O6').value='ณ 31 ต.ค. 69'
 sheet.getRow(9).values=[1,'Paper','original size','วัสดุสำนักงาน',1234,'อัน/โหล',6,1,0,0,0,0,0,0,0,0,0]
 const detail=workbook.addWorksheet('1');detail.getCell('E4').value='Paper';detail.getCell('F9').value=0
 const buffer=await workbook.xlsx.writeBuffer()
 const file=new File([buffer as BlobPart],'source.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
 render(React.createElement(ImportSection))
 await selectImportMode('material')
 fireEvent.change(screen.getByLabelText('เลือกไฟล์วัสดุ (Excel)'),{target:{files:[file]}})
 const before=calls.length
 await waitFor(()=>assert.equal(calls.length,before+1))
 assert.equal(calls[before].type,'material')
 assert.ok(calls[before].csv.includes('\u0e2d\u0e31\u0e19/\u0e42\u0e2b\u0e25'))
 await waitFor(()=>assert.equal(screen.queryByRole('region',{name:'สรุปก่อนนำเข้าวัสดุ'}),null))
 assert.equal(screen.queryByRole('button',{name:'ยืนยันนำเข้าวัสดุ'}),null)
})
test('material form accepts the Excel template with zero quantity', async () => {
 const { ImportSection } = await import('./metadata-sections')
 const { populateImportTemplate } = await import('../../items/import-template')
 const workbook = new ExcelJS.Workbook()
 populateImportTemplate(workbook, 'material')
 const buffer = await workbook.xlsx.writeBuffer()
 const file=new File([buffer as BlobPart],'materials.xlsx')
 const before=calls.length
 render(React.createElement(ImportSection))
 await selectImportMode('material')
 assert.ok(screen.getByRole('button',{name:'ดาวน์โหลดเทมเพลต (Excel)'}))
 fireEvent.change(screen.getByLabelText('เลือกไฟล์วัสดุ (Excel)'),{target:{files:[file]}})
 await waitFor(()=>assert.equal(calls.length,before+1))
 assert.ok(calls[before].csv.includes('"0"'))
})

test('material upload accepts only Excel and rejects CSV without preparing or saving it', async () => {
 const { MaterialImportForm } = await import('./material-import-form')
 render(React.createElement(MaterialImportForm, { onBusyChange: () => {} }))
 const input = screen.getByLabelText('เลือกไฟล์วัสดุ (Excel)') as HTMLInputElement
 assert.equal(input.accept, '.xlsx')
 assert.equal(screen.queryByText(/CSV/), null)
 const before = calls.length
 fireEvent.change(input, { target: { files: [new File(['item_name,quantity\nPaper,1'], 'materials.csv', { type: 'text/csv' })] } })
 await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /Excel \.xlsx/))
 assert.equal(screen.queryByRole('region', { name: 'สรุปก่อนนำเข้าวัสดุ' }), null)
 assert.equal(calls.length, before)
})

test('material validation errors stop automatic saving', async () => {
 const { MaterialImportForm } = await import('./material-import-form')
 render(React.createElement(MaterialImportForm, { onBusyChange: () => {} }))
 const workbook = new ExcelJS.Workbook()
 workbook.addWorksheet('วัสดุ').addRows([['ชื่อวัสดุ', 'จำนวน'], ['Invalid stock', -1]])
 const buffer = await workbook.xlsx.writeBuffer()
 const before = calls.length
 fireEvent.change(screen.getByLabelText('เลือกไฟล์วัสดุ (Excel)'), { target: { files: [new File([buffer as BlobPart], 'invalid.xlsx')] } })
 await waitFor(() => assert.ok(screen.getByRole('alert')))
 assert.equal(calls.length, before)
 assert.equal(screen.queryByRole('button', { name: 'ยืนยันนำเข้าวัสดุ' }), null)
})

test('automatic material import displays the server error and permits retry', async () => {
 const { MaterialImportForm } = await import('./material-import-form')
 pendingImport = Promise.resolve({ success: false, message: 'พบวัสดุซ้ำในระบบ' })
 try {
  render(React.createElement(MaterialImportForm, { onBusyChange: () => {} }))
  const workbook = new ExcelJS.Workbook()
  workbook.addWorksheet('วัสดุ').addRows([['ชื่อวัสดุ', 'จำนวน'], ['Paper retry', 2]])
  const buffer = await workbook.xlsx.writeBuffer()
  const file = new File([buffer as BlobPart], 'retry.xlsx')
  const before = calls.length
  fireEvent.change(screen.getByLabelText('เลือกไฟล์วัสดุ (Excel)'), { target: { files: [file] } })
  await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /พบวัสดุซ้ำในระบบ/))
  assert.equal(calls.length, before + 1)
  pendingImport = null
  fireEvent.change(screen.getByLabelText('เลือกไฟล์วัสดุ (Excel)'), { target: { files: [file] } })
  await waitFor(() => assert.ok(screen.getByText('Imported')))
  assert.equal(calls.length, before + 2)
 } finally { pendingImport = null }
})

test('asset upload rejects CSV and imports the Excel template as assets', async () => {
 const { AssetImportForm } = await import('./asset-import-form')
 const { populateImportTemplate } = await import('../../items/import-template')
 render(React.createElement(AssetImportForm, { onBusyChange: () => {} }))
 const input = screen.getByLabelText('เลือกไฟล์ครุภัณฑ์ (Excel)') as HTMLInputElement
 assert.equal(input.accept, '.xlsx')
 assert.equal(screen.queryByText(/CSV/), null)
 const before = calls.length
 fireEvent.change(input, { target: { files: [new File(['item_name,quantity\nDesk,1'], 'assets.csv', { type: 'text/csv' })] } })
 await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /Excel \.xlsx/))
 assert.equal(calls.length, before)
 const workbook = new ExcelJS.Workbook()
 populateImportTemplate(workbook, 'asset')
 const buffer = await workbook.xlsx.writeBuffer()
 fireEvent.change(input, { target: { files: [new File([buffer as BlobPart], 'assets.xlsx')] } })
 await waitFor(() => assert.equal(calls.length, before + 1))
 assert.equal(calls[before].type, 'asset')
 assert.ok(calls[before].csv.includes('qualified'))
 await waitFor(() => assert.ok(screen.getByText('Imported')))
})
