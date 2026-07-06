'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Save, Image as ImageIcon, Trash2, Upload, Package, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ItemActionState } from '../actions'
import {
  FormField,
  FormLabel,
  FormError,
  FormSection,
  FormGrid,
  FormActions,
  FormInput,
  FormSelect,
  FormTextarea
} from '@/components/ui/form'
import { ItemDetail, ReferenceOption } from '../types'

interface ItemFormProps {
  action: (state: ItemActionState | null, formData: FormData) => Promise<ItemActionState>
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  units: ReferenceOption[]
  item?: ItemDetail
  /** Called after a successful inline create (modal mode). Not called when redirect happens. */
  onSuccess?: () => void
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return <FormError>{errors[0]}</FormError>
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="h-10 px-4 font-semibold flex items-center gap-1.5">
      <Save className="h-4 w-4" />
      <span>{pending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</span>
    </Button>
  )
}

export function ItemForm({ action, categories, locations, units, item, onSuccess }: ItemFormProps) {
  const [state, formAction] = useActionState(action, null)
  // Track which error message version the user has dismissed.
  // Using a ref + state avoids a useEffect→setState cascade.
  const dismissedRef = useRef<typeof state>(null)
  const [dismissed, setDismissed] = useState<typeof state>(null)
  const showError = !!state?.message && dismissed !== state

  // Use a ref for onSuccess callback to avoid infinite loop when parent re-renders
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  }, [onSuccess])

  useEffect(() => {
    if (state?.success) {
      onSuccessRef.current?.()
    }
  }, [state])

  const [activeTab, setActiveTab] = useState<'asset' | 'material'>(
    item?.item_type === 'asset' || !item?.item_type ? 'asset' : 'material'
  )
  const [subType, setSubType] = useState<'material' | 'general'>(
    item?.item_type === 'general' ? 'general' : 'material'
  )

  const itemType = activeTab === 'asset' ? 'asset' : subType

  return (
    <form
      action={formAction}
      className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-6"
    >
      {showError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <span className="material-symbols-outlined text-[28px]">error</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-950">บันทึกข้อมูลไม่สำเร็จ</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{state.message}</p>
              </div>
              <button
                type="button"
                onClick={() => { dismissedRef.current = state; setDismissed(state) }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer"
              >
                ย้อนกลับไปแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-100 mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('asset')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'asset'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>ครุภัณฑ์</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('material')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'material'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          <span>วัสดุและอุปกรณ์</span>
        </button>
      </div>

      <input type="hidden" name="item_type" value={itemType} />

      <FormSection title="1. ข้อมูลทั่วไป">
        <FormGrid>
          <FormField className="sm:col-span-2">
            <FormLabel htmlFor="item_name" required>ชื่อสิ่งของ</FormLabel>
            <FormInput
              id="item_name"
              name="item_name"
              defaultValue={item?.item_name}
              dir="auto"
              required
              aria-invalid={!!state?.fieldErrors?.item_name}
            />
            <FieldError errors={state?.fieldErrors?.item_name} />
          </FormField>

          {activeTab === 'material' && (
            <FormField>
              <FormLabel required>ประเภทย่อย</FormLabel>
              <div className="flex rounded-lg bg-slate-100 p-0.5 max-w-[280px] mt-1">
                <button
                  type="button"
                  onClick={() => setSubType('material')}
                  className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    subType === 'material'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  วัสดุสิ้นเปลือง
                </button>
                <button
                  type="button"
                  onClick={() => setSubType('general')}
                  className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    subType === 'general'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  อุปกรณ์ทั่วไป
                </button>
              </div>
            </FormField>
          )}

          <FormField>
            <FormLabel htmlFor="category_id">หมวดหมู่</FormLabel>
            <FormSelect
              id="category_id"
              name="category_id"
              defaultValue={item?.category?.id ?? ''}
              aria-invalid={!!state?.fieldErrors?.category_id}
            >
              <option value="">ไม่ระบุ</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </FormSelect>
            <FieldError errors={state?.fieldErrors?.category_id} />
          </FormField>

          <FormField>
            <FormLabel htmlFor="quantity" required>จำนวน</FormLabel>
            <FormInput
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              defaultValue={item?.quantity ?? 1}
              required
              aria-invalid={!!state?.fieldErrors?.quantity}
            />
            <FieldError errors={state?.fieldErrors?.quantity} />
          </FormField>

          <FormField>
            <FormLabel htmlFor="unit_id">หน่วยนับ</FormLabel>
            <FormSelect
              id="unit_id"
              name="unit_id"
              defaultValue={item?.unit?.id ?? ''}
              aria-invalid={!!state?.fieldErrors?.unit_id}
            >
              <option value="">ไม่ระบุ</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </FormSelect>
            <FieldError errors={state?.fieldErrors?.unit_id} />
          </FormField>
        </FormGrid>
      </FormSection>

      {activeTab === 'asset' ? (
        <FormSection title="2. ข้อมูลครุภัณฑ์ / ซีเรียล">
          <FormGrid>
            <TextInput name="asset_no" label="เลขครุภัณฑ์" defaultValue={item?.asset_no} errors={state?.fieldErrors?.asset_no} />
            <TextInput name="serial_no" label="Serial Number" defaultValue={item?.serial_no} errors={state?.fieldErrors?.serial_no} />
            <TextInput name="brand" label="ยี่ห้อ" defaultValue={item?.brand} />
            <TextInput name="model" label="รุ่น" defaultValue={item?.model} />
          </FormGrid>
        </FormSection>
      ) : (
        <>
          <input type="hidden" name="asset_no" value="" />
          <input type="hidden" name="serial_no" value="" />
          <input type="hidden" name="brand" value="" />
          <input type="hidden" name="model" value="" />
        </>
      )}

      <FormSection title="3. สถานที่ ผู้รับผิดชอบ และสถานะ">
        <FormGrid>
          <FormField>
            <FormLabel htmlFor="location_id">สถานที่</FormLabel>
            <FormSelect
              id="location_id"
              name="location_id"
              defaultValue={item?.location?.id ?? ''}
              aria-invalid={!!state?.fieldErrors?.location_id}
            >
              <option value="">ไม่ระบุ</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </FormSelect>
            <FieldError errors={state?.fieldErrors?.location_id} />
          </FormField>

          <TextInput name="responsible_person" label="ผู้รับผิดชอบ" defaultValue={item?.responsible_person} />

          <FormField>
            <FormLabel htmlFor="status" required>สถานะ</FormLabel>
            <FormSelect
              id="status"
              name="status"
              defaultValue={item?.status ?? 'active'}
            >
              <option value="active">ใช้งานอยู่</option>
              <option value="spare">สำรอง</option>
              <option value="damaged">ชำรุด</option>
              <option value="waiting_repair">รอซ่อม</option>
              <option value="inactive">ไม่ใช้งาน</option>
              <option value="disposed">จำหน่ายแล้ว</option>
            </FormSelect>
          </FormField>

          <ImageUploadInput defaultValue={item?.image_url} />

          <FormField className="sm:col-span-2">
            <FormLabel htmlFor="note">หมายเหตุ</FormLabel>
            <FormTextarea
              id="note"
              name="note"
              defaultValue={item?.note ?? ''}
              rows={4}
              dir="auto"
            />
          </FormField>
        </FormGrid>
      </FormSection>

      <FormActions>
        <Link href={item ? `/items/${item.id}` : '/items'}>
          <Button type="button" variant="outline" className="h-10 px-4">ยกเลิก</Button>
        </Link>
        <SubmitButton />
      </FormActions>
    </form>
  )
}

function TextInput({
  name,
  label,
  defaultValue,
  errors,
  required,
}: {
  name: string
  label: string
  defaultValue?: string | null
  errors?: string[]
  required?: boolean
}) {
  return (
    <FormField>
      <FormLabel htmlFor={name} required={required}>{label}</FormLabel>
      <FormInput
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        dir="auto"
        aria-invalid={!!errors}
      />
      <FieldError errors={errors} />
    </FormField>
  )
}

function ImageUploadInput({ defaultValue }: { defaultValue?: string | null }) {
  const [preview, setPreview] = useState<string | null>(defaultValue || null)
  const [removed, setRemoved] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setUploadError('กรุณาเลือกไฟล์รูปภาพประเภท JPEG, PNG หรือ WEBP เท่านั้น')
        e.target.value = ''
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB')
        e.target.value = ''
        return
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      const localUrl = URL.createObjectURL(file)
      objectUrlRef.current = localUrl
      setPreview(localUrl)
      setRemoved(false)
      setUploadError(null)
    }
  }

  const handleRemove = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setPreview(null)
    setRemoved(true)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <FormLabel>รูปภาพสิ่งของ</FormLabel>
      
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
        <FieldError errors={uploadError ? [uploadError] : undefined} />
      </div>
    </div>
  )
}

