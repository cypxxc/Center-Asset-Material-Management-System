'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
  Database,
  Terminal,
  FileCode,
  History,
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  X
} from 'lucide-react'
import {
  getTableData,
  upsertTableRow,
  deleteTableRow,
  runAdminSql,
  exportDatabaseData,
  importDatabaseData,
  createAuthUser,
    deleteAuthUser,
    resetAuthPassword,
} from '@/features/admin/actions'
import { cn } from '@/lib/utils'
import { formatDisplayEmail, isInternalEmail } from '@/lib/auth/display-email'
import {
  buildAuditDiff,
  formatJsonForDisplay,
  getAuditActionLabel,
  getAuditTableLabel,
  summarizeAuditPayload,
} from '@/features/audit-log-display/format'

interface ColumnSchema {
  name: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'readonly' | 'auth-uuid'
  options?: { value: string; label: string }[]
}

const TABLE_SCHEMAS: Record<string, ColumnSchema[]> = {
  profiles: [
    { name: 'id', label: 'UUID (auto จาก Auth)', type: 'readonly' },
    { name: 'full_name', label: 'ชื่อ-นามสกุล', type: 'text' },
    { name: 'email', label: 'บัญชี / อีเมล', type: 'readonly' },
    { name: 'role', label: 'บทบาท', type: 'select', options: [
      { value: 'admin', label: 'Admin' },
      { value: 'staff', label: 'Staff' },
      { value: 'viewer', label: 'Viewer' }
    ]},
    { name: 'is_active', label: 'สถานะเปิดใช้งาน', type: 'boolean' },
    { name: 'created_at', label: 'เวลาลงทะเบียน', type: 'readonly' }
  ],
  categories: [
    { name: 'id', label: 'UUID', type: 'readonly' },
    { name: 'name', label: 'ชื่อหมวดหมู่', type: 'text' },
    { name: 'description', label: 'คำอธิบาย', type: 'textarea' },
    { name: 'created_at', label: 'เวลาเพิ่มข้อมูล', type: 'readonly' }
  ],
  locations: [
    { name: 'id', label: 'UUID', type: 'readonly' },
    { name: 'name', label: 'ชื่อสถานที่', type: 'text' },
    { name: 'building', label: 'อาคาร', type: 'text' },
    { name: 'floor', label: 'ชั้น', type: 'text' },
    { name: 'room', label: 'ห้อง', type: 'text' },
    { name: 'department', label: 'แผนก/หน่วยงาน', type: 'text' },
    { name: 'is_active', label: 'สถานะเปิดใช้งาน', type: 'boolean' },
    { name: 'created_at', label: 'เวลาเพิ่มข้อมูล', type: 'readonly' }
  ],
  units: [
    { name: 'id', label: 'UUID', type: 'readonly' },
    { name: 'name', label: 'ชื่อหน่วยนับ', type: 'text' },
    { name: 'is_active', label: 'สถานะเปิดใช้งาน', type: 'boolean' },
    { name: 'created_at', label: 'เวลาเพิ่มข้อมูล', type: 'readonly' }
  ],
  items: [
    { name: 'id', label: 'UUID', type: 'readonly' },
    { name: 'item_name', label: 'ชื่อพัสดุครุภัณฑ์', type: 'text' },
    { name: 'item_type', label: 'ประเภทสิ่งของ', type: 'select', options: [
      { value: 'asset', label: 'ครุภัณฑ์ (Asset)' },
      { value: 'material', label: 'วัสดุสิ้นเปลือง (Material)' },
    ]},
    { name: 'category_id', label: 'หมวดหมู่ ID (UUID)', type: 'text' },
    { name: 'unit_id', label: 'หน่วยนับ ID (UUID)', type: 'text' },
    { name: 'location_id', label: 'สถานที่ ID (UUID)', type: 'text' },
    { name: 'asset_no', label: 'เลขครุภัณฑ์', type: 'text' },
    { name: 'serial_no', label: 'Serial Number', type: 'text' },
    { name: 'brand', label: 'ยี่ห้อ/แบรนด์', type: 'text' },
    { name: 'model', label: 'รุ่นสินค้า', type: 'text' },
    { name: 'quantity', label: 'จำนวน', type: 'number' },
    { name: 'unit_price', label: 'ราคาต่อหน่วย', type: 'number' },
    { name: 'status', label: 'สถานะพัสดุ', type: 'select', options: [
      { value: 'active', label: 'ใช้งานปกติ (Active)' },
      { value: 'spare', label: 'สำรอง (Spare)' },
      { value: 'damaged', label: 'ชำรุด (Damaged)' },
      { value: 'waiting_repair', label: 'รอซ่อม (Waiting Repair)' },
      { value: 'inactive', label: 'ไม่ใช้งาน (Inactive)' },
      { value: 'disposed', label: 'จำหน่ายแล้ว (Disposed)' }
    ]},
    { name: 'responsible_person', label: 'ผู้รับผิดชอบ', type: 'text' },
    { name: 'note', label: 'หมายเหตุ', type: 'textarea' },
    { name: 'created_at', label: 'เวลาลงทะเบียน', type: 'readonly' },
    { name: 'updated_at', label: 'เวลาอัปเดต', type: 'readonly' }
  ],
  audit_logs: [
    { name: 'id', label: 'UUID', type: 'readonly' },
    { name: 'user_id', label: 'รหัสผู้ดูแลระบบ (UUID)', type: 'readonly' },
    { name: 'action', label: 'ประเภทกระทำ', type: 'readonly' },
    { name: 'target_table', label: 'ตารางเป้าหมาย', type: 'readonly' },
    { name: 'target_id', label: 'แถวเป้าหมาย ID', type: 'readonly' },
    { name: 'old_data', label: 'ข้อมูลเก่า (JSON)', type: 'readonly' },
    { name: 'new_data', label: 'ข้อมูลใหม่ (JSON)', type: 'readonly' },
    { name: 'created_at', label: 'วันเวลาบันทึก', type: 'readonly' }
  ]
}

const TABLES = ['profiles', 'categories', 'locations', 'units', 'items', 'audit_logs']

type TabId = 'browser' | 'sql' | 'backup' | 'audit'

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function formatCellValue(row: Record<string, unknown>, colName: string, selectedTable: string, activeTab: TabId) {
  const rawVal = row[colName]

  if (activeTab === 'audit') {
    if (colName === 'action') return getAuditActionLabel(typeof rawVal === 'string' ? rawVal : null)
    if (colName === 'target_table') return getAuditTableLabel(typeof rawVal === 'string' ? rawVal : null)
    if (colName === 'old_data' || colName === 'new_data') {
      return summarizeAuditPayload(asRecord(row.old_data), asRecord(row.new_data))
    }
  }

  if (rawVal === null || rawVal === undefined) return '-'
  if (typeof rawVal === 'boolean') return rawVal ? 'TRUE' : 'FALSE'
  if (typeof rawVal === 'object') return JSON.stringify(rawVal)
  if (selectedTable === 'profiles' && colName === 'email' && typeof rawVal === 'string') {
    return formatDisplayEmail(rawVal)
  }
  return String(rawVal)
}

export default function DBPanelClient() {
  const [activeTab, setActiveTab] = useState<TabId>('browser')
  
  // Tab 1: Tables Browser states
  const [selectedTable, setSelectedTable] = useState<string>('profiles')
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  
  // CRUD states
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null)
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [formNonce, setFormNonce] = useState<string>('')
  const [selectedAuditRow, setSelectedAuditRow] = useState<Record<string, unknown> | null>(null)
  
  // Tab 2: SQL Console states
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM profiles LIMIT 5;')
  const [sqlResult, setSqlResult] = useState<{ rows: Record<string, unknown>[]; command: string; affected_rows?: number } | null>(null)
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [isSqlRunning, setIsSqlRunning] = useState<boolean>(false)
  
  // Tab 3: Backup states
  const [backupResult, setBackupResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isBackupLoading, setIsBackupLoading] = useState<boolean>(false)
  
  // Dynamic PageSize
  const pageSize = 15

  // Fetch Table Data
  const fetchTable = async (tableName: string, page: number) => {
    setIsLoading(true)
    const res = await getTableData(tableName, page, pageSize)
    setIsLoading(false)
    if (res.error) {
      setSqlError(res.error)
    } else {
      setTableData(res.data as Record<string, unknown>[])
      setTotalCount(res.count)
    }
  }

  // Reload current table data
  useEffect(() => {
    const runFetch = async () => {
      if (activeTab === 'browser') {
        await fetchTable(selectedTable, currentPage)
      } else if (activeTab === 'audit') {
        await fetchTable('audit_logs', currentPage)
      }
    }
    runFetch()
  }, [selectedTable, currentPage, activeTab])

  // Reset pagination on table change
  const handleTableChange = (name: string) => {
    setSelectedTable(name)
    setCurrentPage(1)
    setSearchTerm('')
  }

  // Handle Edit/Add Row
  const handleOpenForm = (row: Record<string, unknown> | null = null) => {
    setEditingRow(row)
    setFormData(row ? { ...row } : {})
    // generate a nonce to break browser autofill heuristics for new forms
    if (!row) setFormNonce(String(Date.now()))
    else setFormNonce(typeof row.id === 'string' ? String(row.id) : '')
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleFormChange = (fieldName: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleSaveRow = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const targetTable = activeTab === 'audit' ? 'audit_logs' : selectedTable
    const rowId = (editingRow && typeof editingRow.id === 'string') ? editingRow.id : null

    // Special case: creating a new profile must go through Auth Admin API
    if (targetTable === 'profiles' && !rowId) {
      const email = typeof formData.email === 'string' ? formData.email : ''
      const password = typeof formData._password === 'string' ? formData._password : ''
      const full_name = typeof formData.full_name === 'string' ? formData.full_name : ''
      const role = (formData.role as 'admin' | 'staff' | 'viewer') || 'viewer'
      const is_active = formData.is_active !== false

      // Email is optional now (system can create a placeholder internal email).
      if (!password || !full_name) {
        setFormError('กรุณากรอก ชื่อ-นามสกุล และรหัสผ่าน ให้ครบถ้วน')
        return
      }
      if (password.length < 6) {
        setFormError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
        return
      }

      startTransition(async () => {
        const res = await createAuthUser({ email, password, full_name, role, is_active })
        if (res.error) {
          setFormError(res.error)
        } else {
          setIsFormOpen(false)
          fetchTable(targetTable, currentPage)
        }
      })
      return
    }

    startTransition(async () => {
      // If editing an existing profile and admin provided a new password, reset it first
      if (targetTable === 'profiles' && rowId && typeof formData._new_password === 'string' && formData._new_password) {
        const newPass = String(formData._new_password)
        if (newPass.length < 6) {
          setFormError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
          return
        }

        const pwdRes = await resetAuthPassword(rowId, newPass)
        if (pwdRes.error) {
          setFormError(pwdRes.error)
          return
        }
        // remove the temp password field before upsert
        delete formData._new_password
      }

      const res = await upsertTableRow(targetTable, rowId, formData)
      if (res.error) {
        setFormError(res.error)
      } else {
        setIsFormOpen(false)
        fetchTable(targetTable, currentPage)
      }
    })
  }

  const handleResetPasswordNow = async () => {
    if (!editingRow || selectedTable !== 'profiles') {
      setFormError('ไม่สามารถรีเซ็ตรหัสผ่านได้ในขณะนี้')
      return
    }

    const rowId = typeof editingRow.id === 'string' ? editingRow.id : null
    if (!rowId) {
      setFormError('ไม่สามารถรีเซ็ตรหัสผ่านได้ในขณะนี้')
      return
    }

    const newPass = typeof formData._new_password === 'string' ? formData._new_password : ''
    if (!newPass || newPass.length < 6) {
      setFormError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    setFormError(null)
    startTransition(async () => {
      const res = await resetAuthPassword(rowId, newPass)
      if (res.error) {
        setFormError(res.error)
      } else {
        setFormData(prev => ({ ...prev, _new_password: '' }))
        fetchTable('profiles', currentPage)
        setFormError('รีเซ็ตรหัสผ่านสำเร็จแล้ว')
      }
    })
  }

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแถวข้อมูลนี้อย่างถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้')) return
    const targetTable = activeTab === 'audit' ? 'audit_logs' : selectedTable

    // Profiles must be deleted via Auth Admin API (removes auth.users too)
    if (targetTable === 'profiles') {
      const res = await deleteAuthUser(rowId)
      if (res.error) alert('ลบล้มเหลว: ' + res.error)
      else fetchTable(targetTable, currentPage)
      return
    }

    const res = await deleteTableRow(targetTable, rowId)
    if (res.error) {
      alert('ลบล้มเหลว: ' + res.error)
    } else {
      fetchTable(targetTable, currentPage)
    }
  }

  // Execute SQL
  const handleRunSql = async () => {
    setIsSqlRunning(true)
    setSqlError(null)
    setSqlResult(null)

    try {
      const res = await runAdminSql(sqlQuery)
      if (res.error) {
        setSqlError(res.error)
      } else {
        setSqlResult(res)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setSqlError(errMsg)
    } finally {
      setIsSqlRunning(false)
    }
  }

  // Export JSON Backup
  const handleExport = async () => {
    setIsBackupLoading(true)
    setBackupResult(null)
    try {
      const res = await exportDatabaseData()
      if (res.error) {
        setBackupResult({ type: 'error', message: res.error })
      } else if (res.backup) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.backup, null, 2))
        const downloadAnchor = document.createElement('a')
        downloadAnchor.setAttribute("href", dataStr)
        downloadAnchor.setAttribute("download", `camms_backup_${new Date().toISOString().split('T')[0]}.json`)
        document.body.appendChild(downloadAnchor)
        downloadAnchor.click()
        downloadAnchor.remove()
        setBackupResult({ type: 'success', message: 'สร้างไฟล์สำรองข้อมูลเรียบร้อยแล้ว' })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setBackupResult({ type: 'error', message: errMsg })
    } finally {
      setIsBackupLoading(false)
    }
  }

  // Import JSON Backup
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('คำเตือน: การกู้คืนข้อมูลนี้จะทำการอัปเดต/เขียนทับ (Upsert) ข้อมูลเดิมที่มีอยู่ในฐานข้อมูลทั้งหมด คุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?')) {
      e.target.value = ''
      return
    }

    setIsBackupLoading(true)
    setBackupResult(null)

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const jsonStr = event.target?.result as string
        if (!jsonStr) {
          setIsBackupLoading(false)
          setBackupResult({ type: 'error', message: 'ไม่สามารถอ่านไฟล์กู้คืนได้' })
          return
        }

        const res = await importDatabaseData(jsonStr)
        setIsBackupLoading(false)
        if (res.success) {
          setBackupResult({ type: 'success', message: 'กู้คืนฐานข้อมูลและสร้างประวัติบันทึกการทำงานเรียบร้อยแล้ว' })
          if (activeTab === 'browser') fetchTable(selectedTable, 1)
        } else {
          setBackupResult({ type: 'error', message: res.error || 'การกู้คืนฐานข้อมูลล้มเหลว' })
        }
      }
      reader.readAsText(file)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setIsBackupLoading(false)
      setBackupResult({ type: 'error', message: errMsg })
    } finally {
      e.target.value = ''
    }
  }

  // Local filtering based on SearchTerm
  const filteredData = tableData.filter(row => {
    if (!searchTerm) return true
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const activeSchema = TABLE_SCHEMAS[activeTab === 'audit' ? 'audit_logs' : selectedTable] || []
  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="h-full bg-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950 px-6 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2.5">
          <Database className="h-5 w-5 text-blue-500 animate-pulse" />
          <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
            <span>CAMMS Internal Database Panel</span>
            <span className="text-[9px] font-bold bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800/80 uppercase">
              Super Admin Only
            </span>
          </h1>
        </div>

        {/* Tab Controls */}
        <nav className="flex items-center gap-1">
          {[
            { id: 'browser', label: 'Table Browser', icon: <Database className="h-3.5 w-3.5" /> },
            { id: 'sql', label: 'SQL Query Console', icon: <Terminal className="h-3.5 w-3.5" /> },
            { id: 'backup', label: 'Backup & Restore', icon: <FileCode className="h-3.5 w-3.5" /> },
            { id: 'audit', label: 'Audit Logs', icon: <History className="h-3.5 w-3.5" /> }
          ].map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabId)
                  setCurrentPage(1)
                  setSearchTerm('')
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </header>

      {/* Main Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* Sidebar for Table Browser Mode */}
        {activeTab === 'browser' && (
          <aside className="w-60 border-r border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-3 shrink-0">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
              ตารางข้อมูล (Tables)
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {TABLES.map(tableName => {
                const isSelected = selectedTable === tableName
                return (
                  <button
                    key={tableName}
                    onClick={() => handleTableChange(tableName)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer",
                      isSelected
                        ? "bg-slate-800 text-white font-bold border border-slate-700"
                        : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-300"
                    )}
                  >
                    <span className="font-mono">{tableName}</span>
                    <span className="text-[9px] bg-slate-800/50 text-slate-500 px-1 py-0.5 rounded border border-slate-800">
                      table
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>
        )}

        {/* Tab Panel Contents */}
        <main className="flex-1 min-w-0 flex flex-col bg-slate-950/20">
          
          {/* TAB 1: TABLE BROWSER or TAB 4: AUDIT LOGS */}
          {(activeTab === 'browser' || activeTab === 'audit') && (
            <div className="flex-1 min-h-0 flex flex-col p-6 space-y-4">
              
              {/* Table Toolbar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-white flex items-center gap-1.5">
                    <Database className="h-5 w-5 text-blue-500" />
                    <span className="font-mono text-slate-200">
                      {activeTab === 'audit' ? 'audit_logs' : selectedTable}
                    </span>
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400 border border-slate-800 bg-slate-900 px-2 py-0.5 rounded-full">
                    ทั้งหมด {totalCount} รายการ
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Local Grid Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="ค้นหาข้อมูลในหน้านี้..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 w-52 rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={() => fetchTable(activeTab === 'audit' ? 'audit_logs' : selectedTable, currentPage)}
                    className="h-8 w-8 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer"
                    title="Reload data"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                  </button>

                  {/* Add Row Button (Disabled for read-only audit logs) */}
                  {activeTab !== 'audit' && (
                    <button
                      onClick={() => handleOpenForm(null)}
                      className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>เพิ่มข้อมูล (Insert)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Data Table Container */}
              <div className="flex-1 min-h-0 border border-slate-800 rounded-xl bg-slate-950/60 overflow-auto relative">
                {isLoading ? (
                  <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-800 border-t-blue-500" />
                  </div>
                ) : null}

                <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider sticky top-0 z-10">
                      {activeSchema.map(col => (
                        <th key={col.name} className="py-3 px-4 border-r border-slate-900 last:border-r-0">
                          {col.label}
                          <div className="text-[8px] text-slate-500 font-semibold mt-0.5">{col.name}</div>
                        </th>
                      ))}
                      {activeTab !== 'audit' && (
                        <th className="py-3 px-4 text-center sticky right-0 bg-slate-900 z-20 w-24">จัดการ (Actions)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-semibold font-mono">
                    {filteredData.map((row, idx) => (
                      <tr key={(typeof row.id === 'string' || typeof row.id === 'number') ? row.id : idx} className="hover:bg-slate-900/30 transition-colors">
                        {activeSchema.map(col => {
                          const rawVal = row[col.name]
                          const valStr = formatCellValue(row, col.name, selectedTable, activeTab)
                          const isAuditJsonCell = activeTab === 'audit' && (col.name === 'old_data' || col.name === 'new_data')

                          return (
                            <td 
                              key={col.name} 
                              className={cn(
                                "py-2.5 px-4 border-r border-slate-900/40 last:border-r-0 truncate max-w-[200px]",
                                rawVal === null && "text-slate-600 font-normal italic"
                              )}
                              title={valStr}
                            >
                              {isAuditJsonCell ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAuditRow(row)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-900/50 bg-blue-950/30 px-2 py-1 text-[10px] font-bold text-blue-200 hover:border-blue-700 hover:bg-blue-900/50"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>{valStr}</span>
                                </button>
                              ) : activeTab === 'audit' && (col.name === 'action' || col.name === 'target_table') ? (
                                <div>
                                  <div className="font-bold text-slate-100">{valStr}</div>
                                  <div className="text-[9px] text-slate-500">{String(rawVal ?? '-')}</div>
                                </div>
                              ) : (
                                valStr
                              )}
                            </td>
                          )
                        })}

                        {activeTab !== 'audit' && (
                          <td className="py-2 px-4 sticky right-0 bg-slate-950/80 backdrop-blur-sm text-center flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenForm(row)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title="Edit row"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(String(row.id))}
                              className="p-1 rounded bg-red-950/40 hover:bg-red-900/80 text-red-400 hover:text-white transition-colors cursor-pointer"
                              title="Delete row"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}

                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={activeSchema.length + (activeTab !== 'audit' ? 1 : 0)} className="py-12 text-center text-slate-500 font-semibold italic">
                          ไม่พบแถวข้อมูลในตารางนี้
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 shrink-0">
                  <span className="text-xs text-slate-500 font-bold">
                    หน้า {currentPage} จากทั้งหมด {totalPages} หน้า
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>ก่อนหน้า</span>
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="h-8 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>ถัดไป</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SQL CONSOLE */}
          {activeTab === 'sql' && (
            <div className="flex-1 min-h-0 flex flex-col p-6 space-y-4">
              
              <div className="flex items-center justify-between shrink-0">
                <div className="space-y-0.5">
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-blue-500" />
                    <span>SQL Query Command Console</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    พิมพ์และเรียกใช้ประโยคคำสั่ง SQL ด้านล่าง สิทธิการเขียน/แก้ไขตารางหลักจะขึ้นอยู่กับโครงสร้างที่ระบุในฐานข้อมูล
                  </p>
                </div>

                <button
                  onClick={handleRunSql}
                  disabled={isSqlRunning || !sqlQuery.trim()}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isSqlRunning && "animate-spin")} />
                  <span>เรียกใช้คำสั่ง (Run Query)</span>
                </button>
              </div>

              {/* SQL Textarea Editor */}
              <div className="h-48 border border-slate-800 rounded-xl bg-slate-950 overflow-hidden flex flex-col">
                <div className="h-7 border-b border-slate-900 bg-slate-900/60 px-4 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                  <span>SQL EDITOR</span>
                  <span>PostgreSQL Dialect</span>
                </div>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM items LIMIT 10;"
                  aria-label="ช่องป้อนคำสั่ง SQL"
                  className="flex-1 p-4 bg-slate-950 text-slate-200 font-mono text-xs border-0 outline-none resize-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-700"
                />
              </div>

              {/* Error Trace Notification */}
              {sqlError && (
                <div className="rounded-xl border border-red-900 bg-red-950/20 text-red-400 p-4 flex items-start gap-3 animate-in fade-in duration-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-extrabold text-red-300">เกิดข้อผิดพลาดในการตรวจสอบ SQL</h5>
                    <p className="text-[11px] font-mono leading-relaxed opacity-95">{sqlError}</p>
                    
                    {sqlError.includes('exec_admin_sql') && (
                      <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-red-950 text-[10px] space-y-2 max-w-2xl text-slate-300 font-mono">
                        <p className="text-amber-400 font-bold">⚠️ ยังไม่มีฟังก์ชัน exec_admin_sql ใน Supabase:</p>
                        <p>กรุณาก๊อปปี้ SQL โค้ดในไฟล์ด้านล่างนี้ ไปรันที่ช่อง SQL Editor บนหน้า Supabase Dashboard เพื่อติดตั้งฟังก์ชันความปลอดภัยก่อนรันคำสั่ง:</p>
                        <code className="text-blue-300 block">
                          db/migrations/00007_exec_admin_sql.sql
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SQL Query Result Data Grid */}
              <div className="flex-1 min-h-0 flex flex-col border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
                <div className="h-8 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono shrink-0">
                  <span>ผลลัพธ์การรัน (Query Results)</span>
                  {sqlResult && sqlResult.command && (
                    <span className="text-emerald-400 font-bold">{sqlResult.command} OK</span>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  {isSqlRunning && (
                    <div className="h-full flex items-center justify-center">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-800 border-t-blue-500" />
                    </div>
                  )}

                  {!isSqlRunning && sqlResult && sqlResult.rows && sqlResult.rows.length > 0 && (
                    <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/40 text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider sticky top-0 z-10">
                          {Object.keys(sqlResult.rows[0]).map(key => (
                            <th key={key} className="py-2.5 px-3 border-r border-slate-900 last:border-r-0">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300 font-semibold font-mono">
                        {sqlResult.rows.map((row: Record<string, unknown>, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/20 transition-colors">
                            {Object.keys(sqlResult.rows[0]).map(key => {
                              const val = row[key]
                              const str = val === null || val === undefined ? '-' : typeof val === 'object' ? JSON.stringify(val) : String(val)
                              return (
                                <td key={key} className="py-2 px-3 border-r border-slate-900/40 last:border-r-0 max-w-[250px] truncate" title={str}>
                                  {str}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {!isSqlRunning && sqlResult && (!sqlResult.rows || sqlResult.rows.length === 0) && (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono text-xs">
                      <CheckCircle className="h-6 w-6 text-emerald-500 mb-2" />
                      <p className="font-bold text-slate-300">ดำเนินการคำสั่งสำเร็จเรียบร้อยแล้ว</p>
                      {sqlResult.affected_rows !== undefined && (
                        <p className="mt-1 text-slate-400">จำนวนแถวข้อมูลที่ได้รับผลกระทบ: {sqlResult.affected_rows} แถว</p>
                      )}
                    </div>
                  )}

                  {!isSqlRunning && !sqlResult && !sqlError && (
                    <div className="h-full flex items-center justify-center text-center p-6 text-slate-600 font-mono text-xs italic">
                      กรุณากดเรียกใช้คำสั่งเพื่อประมวลผลและดูคำตอบ
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="flex-1 p-6 max-w-3xl mx-auto space-y-6">
              
              <div className="space-y-0.5">
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-blue-500" />
                  <span>Backup & Restore Center</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  ดาวน์โหลดข้อมูลดิบของระบบเพื่อจัดเก็บสำรองข้อมูล หรือกู้คืนฐานข้อมูลผ่านโครงสร้างตาราง camms
                </p>
              </div>

              {/* Status Notice */}
              {backupResult && (
                <div className={cn(
                  "rounded-xl border p-4 flex items-start gap-3 animate-in fade-in duration-200",
                  backupResult.type === 'success'
                    ? "border-emerald-900 bg-emerald-950/20 text-emerald-400"
                    : "border-red-900 bg-red-950/20 text-red-400"
                )}>
                  {backupResult.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-bold">
                      {backupResult.type === 'success' ? 'สำเร็จเรียบร้อย' : 'เกิดข้อผิดพลาดในการดำเนินการ'}
                    </h5>
                    <p className="text-[11px] leading-relaxed opacity-90">{backupResult.message}</p>
                  </div>
                </div>
              )}

              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Export Card */}
                <div className="border border-slate-800 rounded-2xl p-6 bg-slate-950/60 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="h-10 w-10 rounded-full bg-blue-900/30 text-blue-500 border border-blue-800/80 flex items-center justify-center shadow-sm">
                      <Download className="h-5 w-5" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">สำรองข้อมูลฐานข้อมูล (Export)</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      สร้างไฟล์ประเภท JSON ที่รวบรวมทุกข้อมูลจากตารางหลัก ได้แก่ profiles, items, categories, locations, units และ audit_logs
                    </p>
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={isBackupLoading}
                    className="w-full h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow"
                  >
                    {isBackupLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>ดาวน์โหลดไฟล์ JSON Backup</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="border border-slate-800 rounded-2xl p-6 bg-slate-950/60 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="h-10 w-10 rounded-full bg-emerald-900/30 text-emerald-500 border border-emerald-800/80 flex items-center justify-center shadow-sm">
                      <Upload className="h-5 w-5" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">กู้คืนฐานข้อมูล (Restore)</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      อัปโหลดไฟล์ JSON Backup ที่สร้างจากแผงควบคุมนี้ ระบบจะเขียนทับและบันทึกประวัติการเปลี่ยนแปลงลงฐานข้อมูลโดยอัตโนมัติ
                    </p>
                  </div>

                  <label className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow text-center">
                    {isBackupLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    <span>อัปโหลดกู้คืนข้อมูล</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      disabled={isBackupLoading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedAuditRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 p-5">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-white">
                  รายละเอียดประวัติการทำรายการ
                </h3>
                <p className="text-[11px] text-slate-400">
                  {getAuditActionLabel(String(selectedAuditRow.action ?? ''))}
                  {' · '}
                  {getAuditTableLabel(String(selectedAuditRow.target_table ?? ''))}
                  {' · '}
                  {String(selectedAuditRow.target_id ?? 'ไม่ระบุแถว')}
                </p>
                <p className="text-[10px] text-slate-500">
                  {selectedAuditRow.created_at ? new Date(String(selectedAuditRow.created_at)).toLocaleString('th-TH') : 'ไม่ระบุเวลา'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditRow(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="ปิดรายละเอียดประวัติ"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-5 space-y-4">
              {(() => {
                const oldData = asRecord(selectedAuditRow.old_data)
                const newData = asRecord(selectedAuditRow.new_data)
                const diff = buildAuditDiff(oldData, newData)

                return (
                  <>
                    <section className="rounded-lg border border-slate-800 bg-slate-950/50">
                      <div className="border-b border-slate-800 px-4 py-3">
                        <h4 className="text-xs font-bold text-slate-100">รายการเปลี่ยนแปลง</h4>
                      </div>
                      {diff.length > 0 ? (
                        <div className="divide-y divide-slate-800">
                          {diff.map((entry) => (
                            <div key={entry.key} className="grid gap-3 p-4 md:grid-cols-[180px_1fr_1fr]">
                              <div>
                                <div className="text-xs font-bold text-slate-100">{entry.label}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{entry.key}</div>
                              </div>
                              <div className="rounded-lg border border-red-950/60 bg-red-950/20 p-3">
                                <div className="mb-1 text-[10px] font-bold text-red-300">ค่าเดิม</div>
                                <div className="break-words text-xs text-slate-200">{entry.oldValue}</div>
                              </div>
                              <div className="rounded-lg border border-blue-950/60 bg-blue-950/20 p-3">
                                <div className="mb-1 text-[10px] font-bold text-blue-300">ค่าใหม่</div>
                                <div className="break-words text-xs text-slate-200">{entry.newValue}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-xs text-slate-400">
                          ไม่พบฟิลด์ที่เปลี่ยนแปลง หรือรายการนี้เป็นข้อมูลเหตุการณ์แบบ JSON ดิบ
                        </div>
                      )}
                    </section>

                    <details className="rounded-lg border border-slate-800 bg-slate-950/40">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-slate-200">
                        ดู JSON ต้นฉบับ
                      </summary>
                      <div className="grid gap-3 border-t border-slate-800 p-4 md:grid-cols-2">
                        <div>
                          <div className="mb-2 text-[10px] font-bold text-slate-500">old_data</div>
                          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300">{formatJsonForDisplay(selectedAuditRow.old_data)}</pre>
                        </div>
                        <div>
                          <div className="mb-2 text-[10px] font-bold text-slate-500">new_data</div>
                          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300">{formatJsonForDisplay(selectedAuditRow.new_data)}</pre>
                        </div>
                      </div>
                    </details>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM: Add / Edit Row */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-200">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5 font-mono">
                {editingRow ? 'แก้ไขข้อมูล (Update)' : 'เพิ่มข้อมูล (Insert)'} - {selectedTable}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRow} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-xs text-red-400 font-mono">
                  {formError}
                </div>
              )}

              {/* Special-case insert form for profiles: create Auth user + profile in one action */}
              {!editingRow && selectedTable === 'profiles' ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1 text-xs">
                  <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-3 text-xs text-emerald-200 font-mono space-y-1">
                    <p className="font-bold">✨ สร้างผู้ใช้ใหม่ (Auth) พร้อม Profile ในขั้นตอนเดียว</p>
                    <p className="text-emerald-200/80 leading-relaxed">กรอก อีเมล รหัสผ่าน และข้อมูลโปรไฟล์ ระบบจะสร้างผู้ใช้ใน Authentication และแทรกแถวในตาราง `profiles` ให้โดยอัตโนมัติ</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 font-mono">ชื่อ-นามสกุล <span className="text-[9px] text-slate-600">(full_name)</span></label>
                    <input
                      type="text"
                      name={"full_name_" + formNonce}
                      autoComplete="off"
                      value={typeof formData.full_name === 'string' ? formData.full_name : ''}
                      onChange={(e) => handleFormChange('full_name', e.target.value)}
                      className="h-8 w-full border border-slate-800 bg-slate-950 text-slate-300 rounded-lg px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 font-mono">
                      อีเมล <span className="text-[9px] text-slate-600">(ไม่บังคับ — ว่างไว้สร้างบัญชีภายใน)</span>
                    </label>
                    <input
                      type="email"
                      name={"email_" + formNonce}
                      autoComplete="off"
                      value={typeof formData.email === 'string' ? formData.email : ''}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="เว้นว่างได้ — ผู้ใช้เข้าสู่ระบบด้วยชื่อ-นามสกุล"
                      className="h-8 w-full border border-slate-800 bg-slate-950 text-slate-300 rounded-lg px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 font-mono">รหัสผ่าน <span className="text-[9px] text-slate-600">(password)</span></label>
                    <input
                      type="password"
                      name={"password_" + formNonce}
                      autoComplete="new-password"
                      value={typeof formData._password === 'string' ? formData._password : ''}
                      onChange={(e) => handleFormChange('_password', e.target.value)}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      className="h-8 w-full border border-slate-800 bg-slate-950 text-slate-300 rounded-lg px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 font-mono">บทบาท <span className="text-[9px] text-slate-600">(role)</span></label>
                    <select
                      name={"role_" + formNonce}
                      autoComplete="off"
                      value={typeof formData.role === 'string' ? formData.role : ''}
                      onChange={(e) => handleFormChange('role', e.target.value)}
                      className="h-8 w-full border border-slate-800 bg-slate-950 text-slate-300 rounded-lg px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono cursor-pointer"
                    >
                      <option value="">-- เลือกบทบาท --</option>
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={!!formData.is_active}
                      onChange={(e) => handleFormChange('is_active', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-slate-300 font-bold font-mono">เปิดใช้งาน (is_active)</span>
                  </div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-3 pr-1 text-xs">
                  {editingRow && selectedTable === 'profiles' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-400 font-mono">รีเซ็ตรหัสผ่าน (Reset password)</label>
                        <input
                          type="password"
                          name={"new_password_" + formNonce}
                          autoComplete="new-password"
                          value={typeof formData._new_password === 'string' ? formData._new_password : ''}
                          onChange={(e) => handleFormChange('_new_password', e.target.value)}
                          placeholder="กรอกเพื่อรีเซ็ต รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
                          className="h-8 w-full border border-slate-800 bg-slate-950 text-slate-300 rounded-lg px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetPasswordNow}
                          className="h-9 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                        >
                          รีเซ็ตรหัสผ่านทันที
                        </button>
                        <p className="text-[10px] text-slate-500">หรือกรอกแล้วกดบันทึกเพื่อรีเซ็ตพร้อมกับอัปเดตข้อมูล</p>
                      </div>
                    </div>
                  )}

                  {activeSchema.map(col => {
                    const isReadonly = col.type === 'readonly'
                    const currentValue = formData[col.name] !== undefined ? formData[col.name] : ''

                    return (
                      <div key={col.name} className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-400 font-mono">
                          {col.label} <span className="text-[9px] text-slate-600">({col.name})</span>
                        </label>

                          {isReadonly ? (
                          <div className={cn(
                            "h-8 border border-slate-800/60 bg-slate-950/40 text-slate-500 rounded-lg px-3 flex items-center",
                            col.name === 'email' && typeof currentValue === 'string' && isInternalEmail(String(currentValue))
                              ? 'text-xs font-sans'
                              : 'font-mono',
                          )}>
                            {editingRow
                              ? col.name === 'email' && typeof currentValue === 'string'
                                ? formatDisplayEmail(String(currentValue))
                                : String(currentValue)
                              : col.name === 'email'
                                ? '(ไม่บังคับ — ว่างไว้เพื่อสร้างบัญชีภายใน)'
                                : '(สร้างขึ้นอัตโนมัติ)'}
                          </div>
                        ) : col.type === 'auth-uuid' ? (
                          editingRow ? (
                            // Edit mode: show UUID as readonly
                            <div className="h-8 border border-slate-800/60 bg-slate-950/40 text-slate-500 rounded-lg px-3 flex items-center font-mono text-[10px]">
                              {String(currentValue)}
                            </div>
                          ) : (
                            // Insert mode: editable — must be copied from Supabase Auth
                            <input
                              type="text"
                              name={col.name + '_' + formNonce}
                              autoComplete="off"
                              value={typeof currentValue === 'string' ? currentValue : ''}
                              onChange={(e) => handleFormChange(col.name, e.target.value)}
                              placeholder="วาง UUID จาก Supabase Auth Dashboard..."
                              className="h-8 w-full border border-amber-600/50 bg-amber-950/20 text-amber-300 rounded-lg px-3 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono placeholder:text-amber-800"
                            />
                          )
                          ) : col.type === 'boolean' ? (
                          <div className="flex items-center gap-2 py-1">
                            <input
                              type="checkbox"
                              name={col.name + '_' + formNonce}
                              checked={!!currentValue}
                              onChange={(e) => handleFormChange(col.name, e.target.checked)}
                              className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                            <span className="text-slate-300 font-bold font-mono">เปิดใช้งาน</span>
                          </div>
                          ) : col.type === 'select' ? (
                          <select
                            name={col.name + '_' + formNonce}
                            autoComplete="off"
                            value={typeof currentValue === 'string' || typeof currentValue === 'number' ? currentValue : ''}
                            onChange={(e) => handleFormChange(col.name, e.target.value)}
                            className="h-8 w-full border border-slate-800 bg-slate-950 text-slate-300 rounded-lg px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono cursor-pointer"
                          >
                            <option value="">-- เลือกค่า --</option>
                            {col.options?.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          ) : col.type === 'textarea' ? (
                          <textarea
                            name={col.name + '_' + formNonce}
                            autoComplete="off"
                            value={typeof currentValue === 'string' || typeof currentValue === 'number' ? currentValue : ''}
                            onChange={(e) => handleFormChange(col.name, e.target.value)}
                            className="w-full border border-slate-800 bg-slate-950 text-slate-300 rounded-lg p-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono h-20"
                          />
                        ) : (
                          <input
                            name={col.name + '_' + formNonce}
                            autoComplete="off"
                            type={col.type === 'number' ? 'number' : 'text'}
                            value={typeof currentValue === 'string' || typeof currentValue === 'number' ? currentValue : ''}
                            onChange={(e) => handleFormChange(col.name, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                            className="h-8 w-full border border-slate-800 bg-slate-950 text-slate-300 rounded-lg px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="h-9 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5"
                >
                  {isPending && <RefreshCw className="h-3 w-3 animate-spin" />}
                  <span>บันทึกข้อมูล (Save)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
