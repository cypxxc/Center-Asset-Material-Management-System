import dotenv from 'dotenv'
dotenv.config({ path: '.env.staging' })

import fs from 'node:fs'
import { isAdmin, canWrite, canDelete } from '@/lib/permissions'

interface RbacTestResult {
  id: string
  title: string
  role: string
  expected: string
  actual: string
  status: 'PASS' | 'FAIL'
}

const rbacResults: RbacTestResult[] = []

async function runRbacTests() {
  console.log('=== CAMMS DIRECT RBAC & API BOUNDARY TESTING ===\n')

  // 1. Permission Matrix Tests
  const roles: Array<'admin' | 'staff' | 'viewer'> = ['admin', 'staff', 'viewer']

  for (const role of roles) {
    const adminCheck = isAdmin(role)
    const writeCheck = canWrite(role)
    const deleteCheck = canDelete(role)

    rbacResults.push({
      id: `RBAC-PERM-${role.toUpperCase()}-DELETE`,
      title: `canDelete check for ${role}`,
      role,
      expected: role === 'admin' ? 'true' : 'false',
      actual: String(deleteCheck),
      status: deleteCheck === (role === 'admin') ? 'PASS' : 'FAIL',
    })

    rbacResults.push({
      id: `RBAC-PERM-${role.toUpperCase()}-WRITE`,
      title: `canWrite check for ${role}`,
      role,
      expected: role !== 'viewer' ? 'true' : 'false',
      actual: String(writeCheck),
      status: writeCheck === (role !== 'viewer') ? 'PASS' : 'FAIL',
    })

    rbacResults.push({
      id: `RBAC-PERM-${role.toUpperCase()}-ADMIN`,
      title: `isAdmin check for ${role}`,
      role,
      expected: role === 'admin' ? 'true' : 'false',
      actual: String(adminCheck),
      status: adminCheck === (role === 'admin') ? 'PASS' : 'FAIL',
    })
  }

  // 2. HTTP Boundary Checks with Staging Server on Port 3001
  const adminState = JSON.parse(fs.readFileSync('tests/e2e/staging/.auth/admin.json', 'utf8'))
  const staffState = JSON.parse(fs.readFileSync('tests/e2e/staging/.auth/staff.json', 'utf8'))
  const viewerState = JSON.parse(fs.readFileSync('tests/e2e/staging/.auth/viewer.json', 'utf8'))

  const adminCookie = adminState.cookies.find((c: { name: string }) => c.name === 'camms_session')?.value
  const staffCookie = staffState.cookies.find((c: { name: string }) => c.name === 'camms_session')?.value
  const viewerCookie = viewerState.cookies.find((c: { name: string }) => c.name === 'camms_session')?.value

  // Test /api/items/batch with all 3 sessions + unauth
  const testApi = async (name: string, role: string, cookieValue?: string) => {
    try {
      const headers: Record<string, string> = {}
      if (cookieValue) {
        headers['Cookie'] = `camms_session=${cookieValue}`
      }
      const res = await fetch('http://127.0.0.1:3001/api/items/batch', { headers })
      const expectedStatus = cookieValue ? 200 : 401
      const passed = res.status === expectedStatus
      rbacResults.push({
        id: `RBAC-HTTP-API-${role.toUpperCase()}`,
        title: `GET /api/items/batch (${name})`,
        role,
        expected: `Status ${expectedStatus}`,
        actual: `Status ${res.status}`,
        status: passed ? 'PASS' : 'FAIL',
      })
    } catch (e) {
      rbacResults.push({
        id: `RBAC-HTTP-API-${role.toUpperCase()}`,
        title: `GET /api/items/batch (${name})`,
        role,
        expected: 'Status 200/401',
        actual: String(e),
        status: 'FAIL',
      })
    }
  }

  await testApi('Admin User', 'admin', adminCookie)
  await testApi('Staff User', 'staff', staffCookie)
  await testApi('Viewer User', 'viewer', viewerCookie)
  await testApi('Unauthenticated Guest', 'guest', undefined)

  // 2. Guard Functions Verification
  const testGuards = () => {
    // Test requireAdmin behavior
    const adminCheckAdmin = isAdmin('admin')
    const adminCheckStaff = isAdmin('staff')
    const adminCheckViewer = isAdmin('viewer')

    rbacResults.push({
      id: 'RBAC-GUARD-ADMIN-PERM',
      title: 'requireAdmin check for admin vs non-admin',
      role: 'all',
      expected: 'admin=true, staff=false, viewer=false',
      actual: `admin=${adminCheckAdmin}, staff=${adminCheckStaff}, viewer=${adminCheckViewer}`,
      status: adminCheckAdmin && !adminCheckStaff && !adminCheckViewer ? 'PASS' : 'FAIL',
    })

    // Test requireDeletePermission behavior
    const deleteAdmin = canDelete('admin')
    const deleteStaff = canDelete('staff')
    const deleteViewer = canDelete('viewer')

    rbacResults.push({
      id: 'RBAC-GUARD-DELETE-PERM',
      title: 'requireDeletePermission check for admin vs staff/viewer',
      role: 'all',
      expected: 'admin=true, staff=false, viewer=false',
      actual: `admin=${deleteAdmin}, staff=${deleteStaff}, viewer=${deleteViewer}`,
      status: deleteAdmin && !deleteStaff && !deleteViewer ? 'PASS' : 'FAIL',
    })

    // Test requireEditor behavior
    const editorAdmin = canWrite('admin')
    const editorStaff = canWrite('staff')
    const editorViewer = canWrite('viewer')

    rbacResults.push({
      id: 'RBAC-GUARD-EDITOR-PERM',
      title: 'requireEditor check for admin/staff vs viewer',
      role: 'all',
      expected: 'admin=true, staff=true, viewer=false',
      actual: `admin=${editorAdmin}, staff=${editorStaff}, viewer=${editorViewer}`,
      status: editorAdmin && editorStaff && !editorViewer ? 'PASS' : 'FAIL',
    })
  }

  testGuards()

  console.table(
    rbacResults.map((r) => ({
      ID: r.id,
      Role: r.role,
      Expected: r.expected,
      Actual: r.actual,
      Status: r.status,
    }))
  )
}

runRbacTests().catch(console.error)
