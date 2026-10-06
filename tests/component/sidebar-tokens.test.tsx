import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('sidebar.tsx does not contain forbidden hardcoded slate classes', () => {
  const filePath = path.resolve(process.cwd(), 'components/layout/sidebar.tsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  const forbiddenClasses = [
    'hover:bg-slate-50',
    'bg-slate-50/70',
    'bg-slate-50/30',
    'border-slate-100',
    'text-slate-400',
    'text-slate-500',
    'bg-slate-100',
    'hover:bg-slate-100',
    'hover:border-slate-300',
    'hover:bg-slate-200',
  ]

  const violations: string[] = []
  for (const cls of forbiddenClasses) {
    if (content.includes(cls)) {
      violations.push(cls)
    }
  }

  assert.deepEqual(violations, [], `components/layout/sidebar.tsx contains hardcoded classes: ${violations.join(', ')}`)
})

test('sidebar.tsx uses semantic sidebar and muted tokens', () => {
  const filePath = path.resolve(process.cwd(), 'components/layout/sidebar.tsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  assert.ok(content.includes('hover:bg-sidebar-accent'), 'Should use hover:bg-sidebar-accent')
  assert.ok(content.includes('border-sidebar-border'), 'Should use border-sidebar-border')
  assert.ok(content.includes('bg-sidebar'), 'Should use bg-sidebar tokens')
})
