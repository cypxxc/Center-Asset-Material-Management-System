import { Box, Building2, Save, Tag, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createCategory,
  createLocation,
  createUnit,
  updateCategory,
  updateLocation,
  updateUnit,
  updateProfile,
} from '../actions'
import { CategoryRow, LocationRow, UnitRow, ProfileRow } from '../types'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? 'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100'
          : 'inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200'
      }
    >
      {active ? 'เปิดใช้งาน (Active)' : 'ปิดใช้งาน (Inactive)'}
    </span>
  )
}

function TextInput({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string
  label: string
  defaultValue?: string | null
  required?: boolean
}) {
  return (
    <label className="space-y-1 block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs focus:outline-none focus:border-primary focus:bg-white transition-all"
      />
    </label>
  )
}

function ActiveCheckbox({ defaultChecked }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
      <input
        name="is_active"
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
      เปิดใช้งาน
    </label>
  )
}

function SectionShell({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-100 p-5 bg-slate-50/30">
        <div className="rounded-lg border border-primary/10 bg-blue-50 p-2 text-blue-600">{icon}</div>
        <div>
          <h3 className="text-base font-extrabold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  )
}

export function CategorySection({ categories }: { categories: CategoryRow[] }) {
  return (
    <SectionShell
      title="หมวดหมู่ครุภัณฑ์ (Categories)"
      description="จัดการกลุ่มหรือประเภทหลักที่ใช้ในการขึ้นทะเบียนครุภัณฑ์และพัสดุอุปกรณ์สำนักงาน"
      icon={<Tag className="h-5 w-5" />}
    >
      <form action={createCategory} className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-end">
        <TextInput name="name" label="ชื่อหมวดหมู่ใหม่" required />
        <TextInput name="description" label="คำอธิบายเพิ่มเติม" />
        <div className="pb-2">
          <ActiveCheckbox defaultChecked />
        </div>
        <Button type="submit" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">เพิ่มหมวดหมู่</Button>
      </form>

      <div className="space-y-3">
        {categories.map((category) => (
          <form
            key={category.id}
            action={updateCategory.bind(null, category.id)}
            className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-end hover:bg-slate-50/30 transition-colors"
          >
            <TextInput name="name" label="ชื่อหมวดหมู่" defaultValue={category.name} required />
            <TextInput name="description" label="คำอธิบายเพิ่มเติม" defaultValue={category.description} />
            <div className="flex items-center gap-3 pb-2.5">
              <ActiveCheckbox defaultChecked={category.is_active} />
              <StatusBadge active={category.is_active} />
            </div>
            <Button type="submit" variant="outline" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">
              <Save className="h-3.5 w-3.5 mr-1" />
              บันทึก
            </Button>
          </form>
        ))}
      </div>
    </SectionShell>
  )
}

export function LocationSection({ locations }: { locations: LocationRow[] }) {
  return (
    <SectionShell
      title="สถานที่จัดตั้งและอาคาร (Locations)"
      description="สถานที่ ห้อง แผนก หรืออาคารจัดตั้งที่ระบุในรายการพัสดุครุภัณฑ์สำนักงาน"
      icon={<Building2 className="h-5 w-5" />}
    >
      <form action={createLocation} className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-3 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_1fr_auto_auto] md:items-end">
        <TextInput name="name" label="ชื่อห้อง/สถานที่ใหม่" required />
        <TextInput name="building" label="อาคาร" />
        <TextInput name="floor" label="ชั้น" />
        <TextInput name="room" label="ห้อง" />
        <TextInput name="department" label="แผนก/ส่วนงาน" />
        <div className="pb-2">
          <ActiveCheckbox defaultChecked />
        </div>
        <Button type="submit" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">เพิ่มสถานที่</Button>
      </form>

      <div className="space-y-3">
        {locations.map((location) => (
          <form
            key={location.id}
            action={updateLocation.bind(null, location.id)}
            className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-3 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_1fr_auto_auto] md:items-end hover:bg-slate-50/30 transition-colors"
          >
            <TextInput name="name" label="ชื่อห้อง/สถานที่" defaultValue={location.name} required />
            <TextInput name="building" label="อาคาร" defaultValue={location.building} />
            <TextInput name="floor" label="ชั้น" defaultValue={location.floor} />
            <TextInput name="room" label="ห้อง" defaultValue={location.room} />
            <TextInput name="department" label="แผนก/ส่วนงาน" defaultValue={location.department} />
            <div className="flex items-center gap-3 pb-2.5">
              <ActiveCheckbox defaultChecked={location.is_active} />
              <StatusBadge active={location.is_active} />
            </div>
            <Button type="submit" variant="outline" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">
              <Save className="h-3.5 w-3.5 mr-1" />
              บันทึก
            </Button>
          </form>
        ))}
      </div>
    </SectionShell>
  )
}

export function UnitSection({ units }: { units: UnitRow[] }) {
  return (
    <SectionShell
      title="หน่วยนับสิ่งของ (Units)"
      description="หน่วยนับในการตรวจนับปริมาณสิ่งของเพื่อการจัดระเบียบคลัง เช่น ชิ้น, เครื่อง, ตัว, กล่อง"
      icon={<Box className="h-5 w-5" />}
    >
      <form action={createUnit} className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <TextInput name="name" label="ชื่อหน่วยนับใหม่" required />
        <div className="pb-2">
          <ActiveCheckbox defaultChecked />
        </div>
        <Button type="submit" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">เพิ่มหน่วยนับ</Button>
      </form>

      <div className="space-y-3">
        {units.map((unit) => (
          <form
            key={unit.id}
            action={updateUnit.bind(null, unit.id)}
            className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[1fr_auto_auto] md:items-end hover:bg-slate-50/30 transition-colors"
          >
            <TextInput name="name" label="ชื่อหน่วยนับ" defaultValue={unit.name} required />
            <div className="flex items-center gap-3 pb-2.5">
              <ActiveCheckbox defaultChecked={unit.is_active} />
              <StatusBadge active={unit.is_active} />
            </div>
            <Button type="submit" variant="outline" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">
              <Save className="h-3.5 w-3.5 mr-1" />
              บันทึก
            </Button>
          </form>
        ))}
      </div>
    </SectionShell>
  )
}

export function ProfileSection({ profiles }: { profiles: ProfileRow[] }) {
  return (
    <SectionShell
      title="สิทธิ์และผู้ใช้งานระบบ (User Profiles)"
      description="จัดการบทบาทหน้าที่ (Roles) และเปิดสิทธิ์การใช้งานระบบให้กับบัญชีเจ้าหน้าที่ผู้ใช้งาน"
      icon={<Users className="h-5 w-5" />}
    >
      <div className="space-y-3">
        {profiles.map((profile) => {
          const updateProfileWithId = updateProfile.bind(null, profile.id)
          return (
            <form
              key={profile.id}
              action={updateProfileWithId}
              className="grid gap-3 rounded-lg border border-slate-100 p-4 bg-white shadow-sm md:grid-cols-[1.5fr_1.2fr_1fr_auto] md:items-center hover:bg-slate-50/30 transition-colors"
            >
              <div>
                <div className="font-bold text-slate-800">{profile.full_name}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">{profile.email}</div>
              </div>

              <div>
                <label className="space-y-1 block">
                  <span className="text-xs font-semibold text-slate-500 block">บทบาทสิทธิ์</span>
                  <select
                    name="role"
                    defaultValue={profile.role}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs focus:outline-none focus:border-primary focus:bg-white cursor-pointer"
                  >
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                    <option value="staff">เจ้าหน้าที่ (Staff)</option>
                    <option value="viewer">ผู้เข้าชม (Viewer)</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2 md:pt-0">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={profile.is_active}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-500 cursor-pointer">เปิดสิทธิ์ใช้งานบัญชี</span>
              </div>

              <div className="text-right">
                <Button type="submit" size="sm" className="h-9 px-4 font-bold text-xs cursor-pointer rounded-lg">
                  <Save className="h-3.5 w-3.5 mr-1" />
                  บันทึกสิทธิ์
                </Button>
              </div>
            </form>
          )
        })}
        {profiles.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-6">
            ไม่พบข้อมูลผู้ปฏิบัติงานในระบบขณะนี้
          </div>
        )}
      </div>
    </SectionShell>
  )
}
