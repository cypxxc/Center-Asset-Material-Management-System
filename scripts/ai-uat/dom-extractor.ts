import type { Page } from '@playwright/test'

export interface InteractiveElement {
  id: number
  tag: string
  role?: string
  label: string
  value?: string
  disabled?: boolean
  selector: string
}

export interface DOMSnapshot {
  url: string
  title: string
  elements: InteractiveElement[]
  compactText: string
}

export function formatCompactDOM(url: string, elements: InteractiveElement[]): string {
  if (!elements || elements.length === 0) {
    return `URL: ${url}\n(ไม่มี interactive elements บนหน้าจอ หรือกำลังโหลดข้อมูล)`
  }

  const lines = elements.map(el => {
    let line = `[#${el.id}] ${el.tag}`
    if (el.role && el.role !== el.tag) {
      line += `[role="${el.role}"]`
    }
    line += ` "${el.label.trim()}"`
    if (el.value !== undefined && el.value !== '') {
      line += ` (ค่า: ${el.value})`
    }
    if (el.disabled) {
      line += ' (ปิดใช้งาน)'
    }
    return line
  })

  return `URL: ${url}\nรายการ Elements ที่โต้ตอบได้:\n${lines.join('\n')}`
}

export async function extractInteractiveElements(page: Page): Promise<DOMSnapshot> {
  const url = page.url()
  const title = await page.title().catch(() => '')

  // Evaluate interactive elements inside the browser DOM context
  const rawElements = await page.evaluate(() => {
    const selector = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"]'
    const nodes = Array.from(document.querySelectorAll(selector))

    const isVisible = (elem: Element) => {
      if (!(elem instanceof HTMLElement)) return false
      const style = window.getComputedStyle(elem)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
      const rect = elem.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }

    const items: Array<{
      tag: string
      role?: string
      label: string
      value?: string
      disabled: boolean
      selector: string
    }> = []

    let index = 0
    for (const node of nodes) {
      if (!isVisible(node)) continue
      if (index >= 60) break // limit items per screen to 60 for token budget

      const tag = node.tagName.toLowerCase()
      const role = node.getAttribute('role') || undefined
      const disabled = (node as HTMLButtonElement).disabled || node.getAttribute('aria-disabled') === 'true'

      let label = ''
      let value: string | undefined = undefined

      if (tag === 'input' || tag === 'textarea') {
        const input = node as HTMLInputElement
        const placeholder = input.placeholder || ''
        const name = input.name || ''
        const id = input.id || ''
        const ariaLabel = input.getAttribute('aria-label') || ''
        const type = input.type || 'text'
        
        label = ariaLabel || placeholder || name || id || type
        value = input.value
      } else if (tag === 'select') {
        const select = node as HTMLSelectElement
        const name = select.name || select.id || ''
        const ariaLabel = select.getAttribute('aria-label') || ''
        label = ariaLabel || name || 'เลือกตัวเลือก'
        const selected = select.selectedOptions[0]
        value = selected ? selected.text : select.value
      } else {
        label = node.textContent?.trim() || node.getAttribute('aria-label') || node.getAttribute('title') || ''
      }

      // Truncate long labels
      if (label.length > 50) {
        label = label.slice(0, 47) + '...'
      }

      // Construct a reliable selector
      let generatedSelector = ''
      if (node.id) {
        generatedSelector = `#${CSS.escape(node.id)}`
      } else if (node.getAttribute('name')) {
        generatedSelector = `${tag}[name="${CSS.escape(node.getAttribute('name')!)}"]`
      } else if (tag === 'button' && label) {
        generatedSelector = `button:has-text("${label.replace(/"/g, '\\"')}")`
      } else if (tag === 'a' && node.getAttribute('href')) {
        generatedSelector = `a[href="${CSS.escape(node.getAttribute('href')!)}"]`
      } else {
        generatedSelector = `${tag}:nth-of-type(${index + 1})`
      }

      items.push({
        tag,
        role,
        label: label || `(ไม่ระบุชื่อ ${tag})`,
        value,
        disabled,
        selector: generatedSelector,
      })
      index++
    }

    return items
  })

  const elements: InteractiveElement[] = rawElements.map((el, idx) => ({
    id: idx + 1,
    tag: el.tag,
    role: el.role,
    label: el.label,
    value: el.value,
    disabled: el.disabled,
    selector: el.selector,
  }))

  return {
    url,
    title,
    elements,
    compactText: formatCompactDOM(url, elements),
  }
}
