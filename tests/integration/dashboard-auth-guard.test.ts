import '../setup/dom'
import '../mocks/supabase'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const load = createRequire(`${process.cwd()}/package.json`)
const authPath = load.resolve('./features/auth/queries')
load(authPath)
load.cache[authPath]!.exports = { getCurrentProfile: async () => null }
const { default: DashboardLayout } = load('./app/(dashboard)/layout') as typeof import('../../app/(dashboard)/layout')

test('dashboard never renders protected children without an active profile', async () => {
  await assert.rejects(DashboardLayout({ children: 'protected content' }), /NEXT_REDIRECT/)
})
