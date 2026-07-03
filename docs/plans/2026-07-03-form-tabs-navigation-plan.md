# Form Tabs Navigation Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** แยกฟอร์มการกรอกข้อมูลสิ่งของเป็น 2 แท็บหลักคือ "ครุภัณฑ์" และ "วัสดุและอุปกรณ์" พร้อมซ่อนฟิลด์ข้อมูลที่ไม่จำเป็นในแต่ละแท็บ เพื่อลดความซับซ้อนในการกรอกข้อมูล

**Architecture:** ปรับแต่งคอมโพเนนต์ `ItemForm` ใน `features/items/components/item-form.tsx` โดยใช้ React state ในการสลับแท็บ และแสดงผลฟิลด์ต่าง ๆ ตามแท็บที่เปิด รวมถึงการกำหนดค่าเริ่มต้นจากข้อมูลเดิม

**Tech Stack:** React 19, Tailwind v4, Lucide Icons

---

### Task 1: ปรับแต่งการควบคุมประเภทสิ่งของในคอมโพเนนต์ ItemForm

**Files:**
- Modify: [item-form.tsx](file:///d:/registry-s/features/items/components/item-form.tsx)

**Step 1: เพิ่ม state สำหรับแท็บและประเภทย่อย**

นำเข้าไอคอนเพิ่มเติม `Package` และ `ClipboardList` จาก `lucide-react`:
```tsx
import { Save, Image as ImageIcon, Trash2, Upload, Package, ClipboardList } from 'lucide-react'
```

ภายในคอมโพเนนต์ `ItemForm` ให้ประกาศ state สำหรับ `activeTab` และ `subType`:
```tsx
  const [activeTab, setActiveTab] = useState<'asset' | 'material'>(
    item?.item_type === 'asset' || !item?.item_type ? 'asset' : 'material'
  )
  const [subType, setSubType] = useState<'material' | 'general'>(
    item?.item_type === 'general' ? 'general' : 'material'
  )

  const itemType = activeTab === 'asset' ? 'asset' : subType
```

**Step 2: ซ่อนประเภทรูปแบบเดิมและใช้แท็บด้านบนแทน**

แทนที่ฟิลด์การเลือกประเภท `item_type` เดิม ด้วยอินพุตประเภทซ่อน (`input type="hidden"`) เพื่อส่งค่าไปกับฟอร์ม:
```tsx
<input type="hidden" name="item_type" value={itemType} />
```

และเพิ่ม HTML ของแถบแท็บด้านบนสุดของฟอร์ม (ก่อน `<FormSection title="1. ข้อมูลทั่วไป">`):
```tsx
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
```

และเพิ่มตัวเลือกย่อยของวัสดุ (ประเภทย่อย) เมื่ออยู่ในแท็บวัสดุ:
```tsx
          {activeTab === 'material' && (
            <FormField>
              <FormLabel required>ประเภทย่อย</FormLabel>
              <div className="flex rounded-lg bg-slate-100 p-0.5 max-w-[280px]">
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
```

---

### Task 2: ซ่อนและแสดงส่วนกรอกข้อมูลครุภัณฑ์ตามการเปิดแท็บ

**Files:**
- Modify: [item-form.tsx](file:///d:/registry-s/features/items/components/item-form.tsx)

**Step 1: กำหนดเงื่อนไขการแสดงผลส่วนข้อมูลครุภัณฑ์**

แก้ไขส่วนของ `<FormSection title="2. ข้อมูลครุภัณฑ์ / ซีเรียล">` ให้แสดงผลเมื่อ `activeTab === 'asset'` เท่านั้น:
```tsx
      {activeTab === 'asset' && (
        <FormSection title="2. ข้อมูลครุภัณฑ์ / ซีเรียล">
          <FormGrid>
            <TextInput name="asset_no" label="เลขครุภัณฑ์" defaultValue={item?.asset_no} errors={state?.fieldErrors?.asset_no} />
            <TextInput name="serial_no" label="Serial Number" defaultValue={item?.serial_no} errors={state?.fieldErrors?.serial_no} />
            <TextInput name="brand" label="ยี่ห้อ" defaultValue={item?.brand} />
            <TextInput name="model" label="รุ่น" defaultValue={item?.model} />
          </FormGrid>
        </FormSection>
      )}
```

---

### Task 3: การรันชุดการทดสอบ

**Step 1: ตรวจสอบความถูกต้องของการทำงานผ่านการทดสอบเดิม**

รันคำสั่งทดสอบของโปรเจกต์:
`npm test`
ผลลัพธ์ที่คาดหวัง: การทดสอบทั้งหมดต้องผ่าน (PASS)
