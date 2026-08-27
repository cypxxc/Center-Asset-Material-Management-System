import { AssetNumberTemplate } from './types'

const tokenPattern = /\{([a-z][a-z0-9_]*)(?::([1-9][0-9]?))?\}/gi

export function getAssetNumberTokens(pattern: string) {
  return [...pattern.matchAll(tokenPattern)].map((match) => ({
    key: match[1],
    width: match[2] ? Number(match[2]) : undefined,
  }))
}

export function renderAssetNumber(template: AssetNumberTemplate, payload: Record<string, string>, running?: number) {
  const values = { ...template.field_defaults, ...payload }
  return template.pattern.replace(tokenPattern, (_token, key: string, width?: string) => {
    if (key === 'running') {
      if (running === undefined) return width ? '0'.repeat(Number(width)) : '0'
      return width ? String(running).padStart(Number(width), '0') : String(running)
    }
    return values[key] ?? `{${key}${width ? `:${width}` : ''}}`
  })
}

export function getEditableAssetNumberTokens(template: AssetNumberTemplate) {
  return getAssetNumberTokens(template.pattern)
    .filter(({ key }) => key !== 'running')
    .filter(({ key }, index, values) => values.findIndex((value) => value.key === key) === index)
}

