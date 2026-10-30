# AI Autonomous UAT with Gemini API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an autonomous AI User Acceptance Testing (UAT) agent powered by Google Gemini API and Playwright to autonomously test CAMMS across Admin, Staff, and Viewer roles with business scenario goals, exploratory defect hunting, and an interactive HTML report.

**Architecture:** Build a modular subsystem under `scripts/ai-uat/`. A Playwright-driven browser controller interacts with CAMMS pages, extracts a compact DOM accessibility tree, and presents it to Gemini API via structured Function Calling tools (`click_element`, `fill_input`, `select_option`, `navigate_to`, `assert_condition`, `complete_goal`). An autonomous execution loop with 15-step safety caps and stagnation guards drives test scenarios and exploratory passes, generating a single-file interactive HTML report and Markdown summary in `test-results/uat/`.

**Tech Stack:** Node.js 24, TypeScript 5.x, Playwright (`@playwright/test`), Google Gemini API (`gemini-2.5-flash`), Tailwind CSS (HTML report styling), Sarabun font.

**Spec:** [`docs/superpowers/specs/2026-10-30-ai-autonomous-uat-gemini-design.md`](file:///D:/Center-Asset-Material-Management-System-main/docs/superpowers/specs/2026-10-30-ai-autonomous-uat-gemini-design.md)

## Global Constraints

- Runtime: Node.js `>=24.0.0 <25`, TypeScript 5.x strict (`tsc --noEmit --noUnusedLocals --noUnusedParameters`).
- Gemini API: Standard REST v1beta endpoint using native `fetch` (zero unnecessary external SDK overhead) with `gemini-2.5-flash` model.
- Model API Key: Read from `.env.local` or environment variable `GEMINI_API_KEY`.
- Browser Automation: Playwright Chromium browser instance, supporting both headless (default) and `--headed` mode.
- Thai Text: All input text keystrokes must be NFC-normalized via `lib/unicode.ts`.
- Security & DB: Runs against local or staging environment (`http://localhost:3000` or `http://localhost:3001`), never modifying production database directly.
- Reporting: Reports must be output to `test-results/uat/index.html` (interactive single-page HTML) and `test-results/uat/SUMMARY.md`.

## Review Focus

1. **Missing or Invalid `GEMINI_API_KEY`:** Must output an informative Thai error message explaining how to add `GEMINI_API_KEY` to `.env.local` without crashing or launching the browser.
2. **Infinite Loops or Stagnant Pages:** Must strictly abort any scenario after 15 steps or 3 consecutive unchanged DOM states, capturing a failure screenshot and logging reason in Thai.
3. **Thai Unicode & Invisible Character Handling:** Keystrokes with vowels, tone marks, or zero-width spaces must be normalized to prevent corrupted state in database.
4. **Session Expiry or Unauthenticated Redirect:** Must verify session validity for Admin, Staff, and Viewer from staging auth files before executing scenarios, gracefully alerting if auth state is missing.
5. **Report Self-Containment:** The generated `index.html` must open cleanly offline in any standard browser without broken relative links or missing external stylesheet dependencies.

---

### Task 1: Scenarios & Data Types Foundation

**Files:**
- Create: `scripts/ai-uat/scenarios/types.ts`
- Test: `tests/unit/ai-uat-types.test.ts`

**Interfaces:**
- Produces:
  - `UserRole`: `'admin' | 'staff' | 'viewer'`
  - `UATScenario`: `{ id: string; role: UserRole; title: string; goal: string; successCriteria: string[]; maxSteps?: number }`
  - `AgentStepAction`: `{ stepNumber: number; thought: string; tool: string; args: Record<string, unknown>; screenshotPath?: string; timestamp: string }`
  - `ScenarioResult`: `{ scenarioId: string; role: UserRole; status: 'PASS' | 'FAIL'; durationMs: number; summary: string; steps: AgentStepAction[]; defects: DefectFinding[] }`
  - `DefectFinding`: `{ severity: 'Critical' | 'Major' | 'Minor'; title: string; description: string; screenshotPath?: string }`

- [ ] **Step 1: Write the unit test for scenario type validation**

```typescript
// tests/unit/ai-uat-types.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import type { UATScenario, ScenarioResult } from '../../scripts/ai-uat/scenarios/types'

test('validates UATScenario contract', () => {
  const scenario: UATScenario = {
    id: 'TC-ADM-01',
    role: 'admin',
    title: 'Dashboard Overview',
    goal: 'Verify dashboard loads KPI cards',
    successCriteria: ['KPI cards visible', 'No error banner'],
  }
  assert.equal(scenario.id, 'TC-ADM-01')
  assert.equal(scenario.role, 'admin')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/ai-uat-types.test.ts`
Expected: FAIL (Cannot find module `../../scripts/ai-uat/scenarios/types`)

- [ ] **Step 3: Implement `scripts/ai-uat/scenarios/types.ts`**

Define `UserRole`, `UATScenario`, `AgentStepAction`, `ScenarioResult`, `DefectFinding`, and `UATRunReport`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/ai-uat-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ai-uat/scenarios/types.ts tests/unit/ai-uat-types.test.ts
git commit -m "feat(ai-uat): create scenario data types and contracts"
```

---

### Task 2: Gemini API Client & Tool Schemas

**Files:**
- Create: `scripts/ai-uat/config.ts`
- Create: `scripts/ai-uat/gemini-client.ts`
- Test: `tests/unit/gemini-client.test.ts`

**Interfaces:**
- Consumes: `GEMINI_API_KEY` from `.env.local`
- Produces:
  - `getUATConfig(): UATConfig`
  - `class GeminiUATClient`:
    - `decideNextAction(context: AgentPromptContext): Promise<AgentDecision>`
    - `tools`: Function declaration schemas (`click_element`, `fill_input`, `select_option`, `navigate_to`, `assert_condition`, `complete_goal`)

- [ ] **Step 1: Write the unit test for Gemini Client prompt and tool formatting**

```typescript
// tests/unit/gemini-client.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { UAT_TOOL_DECLARATIONS, formatSystemPrompt } from '../../scripts/ai-uat/gemini-client'

test('UAT_TOOL_DECLARATIONS exposes required testing tools', () => {
  const toolNames = UAT_TOOL_DECLARATIONS.map(t => t.name)
  assert.ok(toolNames.includes('click_element'))
  assert.ok(toolNames.includes('fill_input'))
  assert.ok(toolNames.includes('complete_goal'))
})

test('formatSystemPrompt includes role and goal instructions', () => {
  const prompt = formatSystemPrompt('staff', 'เพิ่มพัสดุใหม่')
  assert.match(prompt, /staff/i)
  assert.match(prompt, /เพิ่มพัสดุใหม่/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/gemini-client.test.ts`
Expected: FAIL (Cannot find module `../../scripts/ai-uat/gemini-client`)

- [ ] **Step 3: Implement `scripts/ai-uat/config.ts` and `scripts/ai-uat/gemini-client.ts`**

Implement tool declarations, Gemini REST v1beta caller (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`), prompt builders, and API error handlers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/gemini-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ai-uat/config.ts scripts/ai-uat/gemini-client.ts tests/unit/gemini-client.test.ts
git commit -m "feat(ai-uat): implement Gemini API client with function calling tools"
```

---

### Task 3: DOM Accessibility Tree Extractor

**Files:**
- Create: `scripts/ai-uat/dom-extractor.ts`
- Test: `tests/unit/dom-extractor.test.ts`

**Interfaces:**
- Consumes: Playwright `Page`
- Produces:
  - `extractInteractiveElements(page: Page): Promise<DOMSnapshot>`
  - `DOMSnapshot`: `{ url: string; title: string; elements: InteractiveElement[]; compactText: string }`
  - `InteractiveElement`: `{ id: number; tag: string; role?: string; label: string; value?: string; disabled?: boolean; selector: string }`

- [ ] **Step 1: Write unit test for DOM representation formatter**

```typescript
// tests/unit/dom-extractor.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCompactDOM } from '../../scripts/ai-uat/dom-extractor'

test('formatCompactDOM serializes interactive elements into readable lines', () => {
  const elements = [
    { id: 1, tag: 'button', label: 'บันทึกข้อมูล', disabled: false, selector: 'button:has-text("บันทึกข้อมูล")' },
    { id: 2, tag: 'input', label: 'ชื่อพัสดุ', value: '', disabled: false, selector: 'input[name="name"]' },
  ]
  const formatted = formatCompactDOM('/items/new', elements)
  assert.match(formatted, /\[#1\] button "บันทึกข้อมูล"/)
  assert.match(formatted, /\[#2\] input "ชื่อพัสดุ"/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/dom-extractor.test.ts`
Expected: FAIL (Cannot find module `../../scripts/ai-uat/dom-extractor`)

- [ ] **Step 3: Implement `scripts/ai-uat/dom-extractor.ts`**

Scan interactive elements (buttons, inputs, links, selects, comboboxes), assign unique IDs `[#1]`, `[#2]`, generate deterministic Playwright selectors, and format compact text output.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/dom-extractor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ai-uat/dom-extractor.ts tests/unit/dom-extractor.test.ts
git commit -m "feat(ai-uat): implement compact DOM accessibility extractor"
```

---

### Task 4: Autonomous Agent Driver & Guardrails

**Files:**
- Create: `scripts/ai-uat/agent-driver.ts`
- Test: `tests/unit/agent-driver.test.ts`

**Interfaces:**
- Consumes: `GeminiUATClient`, `dom-extractor`, Playwright `Page`
- Produces:
  - `runScenario(page: Page, scenario: UATScenario, client: GeminiUATClient, outputDir: string): Promise<ScenarioResult>`
  - Guardrails: Maximum 15 steps cap, 3-step stagnation detection, NFC Unicode text input via `normalizeForStorage`.

- [ ] **Step 1: Write unit test for stagnation and step limit detection**

```typescript
// tests/unit/agent-driver.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { isStagnant } from '../../scripts/ai-uat/agent-driver'

test('isStagnant detects 3 identical DOM hashes in sequence', () => {
  const history = ['hash1', 'hash2', 'hash2', 'hash2']
  assert.equal(isStagnant(history), true)
})

test('isStagnant returns false when state is progressing', () => {
  const history = ['hash1', 'hash2', 'hash3']
  assert.equal(isStagnant(history), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/agent-driver.test.ts`
Expected: FAIL (Cannot find module `../../scripts/ai-uat/agent-driver`)

- [ ] **Step 3: Implement `scripts/ai-uat/agent-driver.ts`**

Implement execution loop: capture DOM + screenshot -> request Gemini action -> execute action on Playwright page with timeout & retry -> verify assertion or completion -> check stagnation & step caps.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/agent-driver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ai-uat/agent-driver.ts tests/unit/agent-driver.test.ts
git commit -m "feat(ai-uat): implement autonomous agent execution loop with guardrails"
```

---

### Task 5: Scenario Catalog (Admin, Staff, Viewer & Exploratory)

**Files:**
- Create: `scripts/ai-uat/scenarios/admin.scenarios.ts`
- Create: `scripts/ai-uat/scenarios/staff.scenarios.ts`
- Create: `scripts/ai-uat/scenarios/viewer.scenarios.ts`
- Create: `scripts/ai-uat/scenarios/index.ts`
- Test: `tests/unit/scenarios-catalog.test.ts`

**Interfaces:**
- Produces:
  - `ADMIN_SCENARIOS: UATScenario[]` (Dashboard, Item Lifecycle, Users Self-Protection, Export)
  - `STAFF_SCENARIOS: UATScenario[]` (Create/Edit Item, RBAC Boundary Check, Search/Filter)
  - `VIEWER_SCENARIOS: UATScenario[]` (Read-only Browsing, Mutation Block)
  - `getAllScenarios(roleFilter?: UserRole): UATScenario[]`

- [ ] **Step 1: Write unit test to verify scenario catalog completeness**

```typescript
// tests/unit/scenarios-catalog.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAllScenarios } from '../../scripts/ai-uat/scenarios'

test('getAllScenarios returns all 3 roles with expected test IDs', () => {
  const all = getAllScenarios()
  const ids = all.map(s => s.id)
  assert.ok(ids.includes('TC-ADM-01'))
  assert.ok(ids.includes('TC-STF-02'))
  assert.ok(ids.includes('TC-VIW-01'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/scenarios-catalog.test.ts`
Expected: FAIL (Cannot find module `../../scripts/ai-uat/scenarios`)

- [ ] **Step 3: Implement scenario definitions in `scripts/ai-uat/scenarios/`**

Write Thai-first instructions, goals, and success criteria for all Admin, Staff, and Viewer test cases as specified in the Design Spec.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/scenarios-catalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ai-uat/scenarios/ tests/unit/scenarios-catalog.test.ts
git commit -m "feat(ai-uat): define UAT scenarios for admin, staff, and viewer"
```

---

### Task 6: Interactive HTML & Markdown Reporter

**Files:**
- Create: `scripts/ai-uat/reporter/template.html`
- Create: `scripts/ai-uat/reporter/report-builder.ts`
- Test: `tests/unit/report-builder.test.ts`

**Interfaces:**
- Consumes: `UATRunReport`
- Produces:
  - `buildHTMLReport(report: UATRunReport, outputPath: string): Promise<void>`
  - `buildMarkdownSummary(report: UATRunReport, outputPath: string): Promise<string>`

- [ ] **Step 1: Write unit test for markdown summary and HTML report compilation**

```typescript
// tests/unit/report-builder.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateMarkdownContent } from '../../scripts/ai-uat/reporter/report-builder'
import type { UATRunReport } from '../../scripts/ai-uat/scenarios/types'

test('generateMarkdownContent generates table with pass rate', () => {
  const report: UATRunReport = {
    timestamp: new Date().toISOString(),
    totalDurationMs: 12000,
    model: 'gemini-2.5-flash',
    results: [
      { scenarioId: 'TC-ADM-01', role: 'admin', status: 'PASS', durationMs: 4000, summary: 'All good', steps: [], defects: [] },
    ],
    readinessScore: 100,
  }
  const md = generateMarkdownContent(report)
  assert.match(md, /100%/)
  assert.match(md, /TC-ADM-01/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/report-builder.test.ts`
Expected: FAIL (Cannot find module `../../scripts/ai-uat/reporter/report-builder`)

- [ ] **Step 3: Implement `scripts/ai-uat/reporter/template.html` and `report-builder.ts`**

Build single-file HTML report with embedded CSS, Sarabun font styling, expandable scenario timeline, lightbox screenshot zoom modal, and defect list. Implement Markdown exporter.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/report-builder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ai-uat/reporter/ tests/unit/report-builder.test.ts
git commit -m "feat(ai-uat): implement interactive HTML and markdown reporting"
```

---

### Task 7: CLI Runner & NPM Script Integration

**Files:**
- Create: `scripts/ai-uat/run.ts`
- Modify: `package.json:20-46`
- Test: `tests/unit/cli-args.test.ts`

**Interfaces:**
- Consumes: Process arguments (`--headed`, `--role <admin|staff|viewer>`, `--scenario <id>`)
- Produces: Execution CLI entrypoint runnable via `npm run test:uat:ai`

- [ ] **Step 1: Write test for CLI argument parsing**

```typescript
// tests/unit/cli-args.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCliArgs } from '../../scripts/ai-uat/run'

test('parseCliArgs handles role and headed flags', () => {
  const args = parseCliArgs(['--role', 'admin', '--headed'])
  assert.equal(args.role, 'admin')
  assert.equal(args.headed, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unit/cli-args.test.ts`
Expected: FAIL (Cannot find module `../../scripts/ai-uat/run`)

- [ ] **Step 3: Implement `scripts/ai-uat/run.ts` and update `package.json`**

Read config, check for `GEMINI_API_KEY`, launch Playwright browser, load role auth state from `tests/e2e/staging/.auth/`, execute scenarios via `agent-driver`, compile reports, and write to `test-results/uat/`. Add npm scripts to `package.json`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unit/cli-args.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/ai-uat/run.ts package.json tests/unit/cli-args.test.ts
git commit -m "feat(ai-uat): add CLI runner and npm test:uat:ai scripts"
```

---

### Task 8: Full Quality Gate & Autonomous UAT Verification

**Files:**
- Output: `test-results/uat/index.html`
- Output: `test-results/uat/SUMMARY.md`

- [ ] **Step 1: Run typecheck across the whole repository**

Run: `npm run typecheck`
Expected: Code 0, zero TypeScript errors.

- [ ] **Step 2: Run full unit test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Execute AI Autonomous UAT Run**

Run: `npm run test:uat:ai`
Expected: Agent connects to Gemini API, runs scenarios for Admin, Staff, Viewer, and produces `test-results/uat/index.html` and `test-results/uat/SUMMARY.md`.

- [ ] **Step 4: Verify report artifacts**

Verify that `test-results/uat/index.html` and `test-results/uat/SUMMARY.md` exist and contain test steps, screenshots, and readiness score.

- [ ] **Step 5: Final Commit**

```bash
git add test-results/uat/
git commit -m "test(ai-uat): generate initial autonomous UAT report with Gemini API"
```
