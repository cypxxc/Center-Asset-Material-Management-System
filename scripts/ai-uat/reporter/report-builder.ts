import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { UATRunReport } from '../scenarios/types'

export function generateMarkdownContent(report: UATRunReport): string {
  const total = report.results.length
  const passed = report.results.filter(r => r.status === 'PASS').length
  const failed = total - passed

  let content = `# รายงานสรุปผลการทดสอบ UAT ด้วย AI Autonomous (Gemini API)

- **วันที่และเวลา:** ${report.timestamp}
- **โมเดล AI:** \`${report.model}\`
- **ระยะเวลาการทดสอบรวม:** ${(report.totalDurationMs / 1000).toFixed(2)} วินาที
- **คะแนนความพร้อมระบบ (Readiness Score):** **${report.readinessScore}%**
- **ผลการทดสอบ:** ผ่าน ${passed} / ไม่ผ่าน ${failed} (รวม ${total} เคส)

---

## ตารางสรุปราย Scenario

| รหัสทดสอบ | บทบาท | สถานะ | ระยะเวลา | สรุปผล |
|-----------|-------|-------|----------|--------|
`

  for (const r of report.results) {
    const statusBadge = r.status === 'PASS' ? '✅ ผ่าน (PASS)' : '❌ ไม่ผ่าน (FAIL)'
    content += `| \`${r.scenarioId}\` | ${r.role.toUpperCase()} | ${statusBadge} | ${(r.durationMs / 1000).toFixed(2)}s | ${r.summary} |\n`
  }

  // Defects section
  const allDefects = report.results.flatMap(r => r.defects)
  if (allDefects.length > 0) {
    content += `\n---\n\n## รายการข้อบกพร่องที่ตรวจพบ (${allDefects.length} รายการ)\n\n`
    for (const d of allDefects) {
      content += `### [${d.severity}] ${d.title}\n`
      content += `${d.description}\n\n`
      if (d.screenshotPath) {
        content += `- ภาพหลักฐาน: \`${d.screenshotPath}\`\n\n`
      }
    }
  } else {
    content += `\n---\n\n> 🎉 **ยอดเยี่ยม:** ไม่พบข้อบกพร่องหรือความผิดปกติในการทดสอบรอบนี้\n`
  }

  return content
}

export async function buildHTMLReport(report: UATRunReport, outputPath: string): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true })

  const templatePath = join(__dirname, 'template.html')
  let html = readFileSync(templatePath, 'utf8')

  const total = report.results.length
  const passed = report.results.filter(r => r.status === 'PASS').length
  const failed = total - passed

  html = html
    .replace('{{READINESS_SCORE}}', String(report.readinessScore))
    .replace('{{TOTAL_SCENARIOS}}', String(total))
    .replace('{{PASSED_COUNT}}', String(passed))
    .replace('{{FAILED_COUNT}}', String(failed))

  let scenariosHtml = ''
  for (const r of report.results) {
    const badgeClass = r.status === 'PASS' ? 'badge-pass' : 'badge-fail'
    scenariosHtml += `
      <div class="scenario-card">
        <div class="scenario-header" onclick="toggleAccordion('${r.scenarioId}')">
          <div class="scenario-meta">
            <span class="badge ${badgeClass}">${r.status}</span>
            <span class="badge badge-role">${r.role}</span>
            <strong>${r.scenarioId}</strong>
          </div>
          <div>${(r.durationMs / 1000).toFixed(2)}s ▾</div>
        </div>
        <div class="scenario-body" id="body-${r.scenarioId}">
          <div class="scenario-summary">${r.summary}</div>
          <div class="steps-timeline">
            ${r.steps.map(s => `
              <div class="step-item">
                <div class="step-header">
                  <span>ขั้นตอนที่ ${s.stepNumber}</span>
                  <span>${s.timestamp}</span>
                </div>
                <div class="step-thought">💭 ${s.thought}</div>
                <div class="step-action">⚡ ${s.tool}(${JSON.stringify(s.args)})</div>
                ${s.screenshotPath ? `<div style="margin-top: 0.5rem;"><button style="cursor: pointer; background: #334155; color: #fff; border: 0; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;" onclick="zoomImg('${s.screenshotPath.replace(/\\/g, '/')}')">🔍 ดูภาพหน้าจอ</button></div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `
  }
  html = html.replace('{{SCENARIOS_HTML}}', scenariosHtml)

  const allDefects = report.results.flatMap(r => r.defects)
  let defectsSectionHtml = ''
  if (allDefects.length > 0) {
    defectsSectionHtml = `
      <div class="section-title" style="margin-top: 2rem;">
        <span>ข้อบกพร่องที่ตรวจพบ (${allDefects.length})</span>
      </div>
      <div>
        ${allDefects.map(d => `
          <div class="defect-card">
            <div class="defect-title">[${d.severity}] ${d.title}</div>
            <div class="defect-desc">${d.description}</div>
          </div>
        `).join('')}
      </div>
    `
  }
  html = html.replace('{{DEFECTS_SECTION}}', defectsSectionHtml)

  writeFileSync(outputPath, html, 'utf8')
}

export async function buildMarkdownSummary(report: UATRunReport, outputPath: string): Promise<string> {
  mkdirSync(dirname(outputPath), { recursive: true })
  const content = generateMarkdownContent(report)
  writeFileSync(outputPath, content, 'utf8')
  return content
}
