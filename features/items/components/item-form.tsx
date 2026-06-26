'use client'

import { useActionState, useState, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemActionState } from '../actions'
import { ItemDetail, ReferenceOption } from '../types'

interface ItemFormProps {
  action: (state: ItemActionState | null, formData: FormData) => Promise<ItemActionState>
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  units: ReferenceOption[]
  item?: ItemDetail
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return <p className="text-xs font-medium text-red-600">{errors[0]}</p>
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="h-10 px-4 font-semibold flex items-center gap-1.5">
      <Save className="h-4.5 w-4.5" />
      <span>{pending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</span>
    </Button>
  )
}

export function ItemForm({ action, categories, locations, units, item }: ItemFormProps) {
  const [state, formAction] = useActionState(action, null)

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-6"
    >
      {state?.message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.message}
        </div>
      )}

      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
          1. ข้อมูลทั่วไป
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="item_name">ชื่อสิ่งของ *</label>
            <input
              id="item_name"
              name="item_name"
              defaultValue={item?.item_name}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
              required
            />
            <FieldError errors={state?.fieldErrors?.item_name} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="item_type">ประเภท *</label>
            <select
              id="item_type"
              name="item_type"
              defaultValue={item?.item_type ?? 'asset'}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
            >
              <option value="asset">ครุภัณฑ์</option>
              <option value="material">วัสดุ</option>
              <option value="general">อุปกรณ์ทั่วไป</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="category_id">หมวดหมู่</label>
            <select
              id="category_id"
              name="category_id"
              defaultValue={item?.category?.id ?? ''}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
            >
              <option value="">ไม่ระบุ</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <FieldError errors={state?.fieldErrors?.category_id} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="quantity">จำนวน *</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              defaultValue={item?.quantity ?? 1}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
              required
            />
            <FieldError errors={state?.fieldErrors?.quantity} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="unit_id">หน่วยนับ</label>
            <select
              id="unit_id"
              name="unit_id"
              defaultValue={item?.unit?.id ?? ''}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
            >
              <option value="">ไม่ระบุ</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
            <FieldError errors={state?.fieldErrors?.unit_id} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
          2. ข้อมูลครุภัณฑ์ / ซีเรียล
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput name="asset_no" label="เลขครุภัณฑ์" defaultValue={item?.asset_no} errors={state?.fieldErrors?.asset_no} />
          <TextInput name="serial_no" label="Serial Number" defaultValue={item?.serial_no} errors={state?.fieldErrors?.serial_no} />
          <TextInput name="brand" label="ยี่ห้อ" defaultValue={item?.brand} />
          <TextInput name="model" label="รุ่น" defaultValue={item?.model} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
          3. สถานที่ ผู้รับผิดชอบ และสถานะ
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="location_id">สถานที่</label>
            <select
              id="location_id"
              name="location_id"
              defaultValue={item?.location?.id ?? ''}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
            >
              <option value="">ไม่ระบุ</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            <FieldError errors={state?.fieldErrors?.location_id} />
          </div>

          <TextInput name="responsible_person" label="ผู้รับผิดชอบ" defaultValue={item?.responsible_person} />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="status">สถานะ *</label>
            <select
              id="status"
              name="status"
              defaultValue={item?.status ?? 'active'}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
            >
              <option value="active">ใช้งานอยู่</option>
              <option value="spare">สำรอง</option>
              <option value="damaged">ชำรุด</option>
              <option value="waiting_repair">รอซ่อม</option>
              <option value="inactive">ไม่ใช้งาน</option>
              <option value="disposed">จำหน่ายแล้ว</option>
            </select>
          </div>

          <ImageUploadInput defaultValue={item?.image_url} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="note">หมายเหตุ</label>
          <textarea
            id="note"
            name="note"
            defaultValue={item?.note ?? ''}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Link href={item ? `/items/${item.id}` : '/items'}>
          <Button type="button" variant="outline" className="h-10 px-4">ยกเลิก</Button>
        </Link>
        <SubmitButton />
      </div>
    </form>
  )
}

function TextInput({
  name,
  label,
  defaultValue,
  errors,
}: {
  name: string
  label: string
  defaultValue?: string | null
  errors?: string[]
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-ring"
      />
      <FieldError errors={errors} />
    </div>
  )
}

function ImageUploadInput({ defaultValue }: { defaultValue?: string | null }) {
  const [preview, setPreview] = useState<string | null>(defaultValue || null)
  const [removed, setRemoved] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('กรุณาเลือกไฟล์รูปภาพประเภท JPEG, PNG หรือ WEBP เท่านั้น')
        e.target.value = ''
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB')
        e.target.value = ''
        return
      }
      const localUrl = URL.createObjectURL(file)
      setPreview(localUrl)
      setRemoved(false)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    setRemoved(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="text-xs font-semibold text-muted-foreground block">รูปภาพสิ่งของ</label>
      
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border p-6 bg-muted/10">
        {preview ? (
          <div className="relative group rounded-lg overflow-hidden border border-border max-w-[240px] max-h-[180px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Item preview"
              className="object-cover w-full h-full max-w-[240px] max-h-[180px] rounded-lg"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-white/90 hover:bg-white rounded-full text-foreground shadow-sm transition-all"
                title="เปลี่ยนรูปภาพ"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="p-2 bg-rose-50 hover:bg-rose-100 rounded-full text-destructive shadow-sm transition-all"
                title="ลบรูปภาพ"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center justify-center gap-2">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">อัปโหลดรูปภาพ</p>
              <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG หรือ WEBP ขนาดไม่เกิน 5MB</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2"
            >
              เลือกไฟล์
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          id="image_file"
          name="image_file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        <input
          type="hidden"
          name="remove_image"
          value={removed ? 'true' : 'false'}
        />
      </div>
    </div>
  )
}

