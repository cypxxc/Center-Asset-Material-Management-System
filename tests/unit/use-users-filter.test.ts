import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildUsersUrl } from '@/features/admin/hooks/use-users-filter'

test('buildUsersUrl constructs correct URL search query for users', () => {
  const url = buildUsersUrl('/admin/users', {
    q: 'admin@domain.com',
    role: 'admin',
    is_active: 'true',
    page: 2,
    pageSize: 20,
  })

  assert.equal(
    url,
    '/admin/users?q=admin%40domain.com&role=admin&is_active=true&page=2&pageSize=20'
  )
})

test('buildUsersUrl omits default values ("all", page 1, pageSize 50)', () => {
  const url = buildUsersUrl('/admin/users', {
    q: '',
    role: 'all',
    is_active: 'all',
    page: 1,
    pageSize: 50,
  })

  assert.equal(url, '/admin/users')
})

test('buildUsersUrl trims query string', () => {
  const url = buildUsersUrl('/admin/users', {
    q: '   somchai   ',
    role: 'staff',
    is_active: 'all',
    page: 1,
    pageSize: 50,
  })

  assert.equal(url, '/admin/users?q=somchai&role=staff')
})
