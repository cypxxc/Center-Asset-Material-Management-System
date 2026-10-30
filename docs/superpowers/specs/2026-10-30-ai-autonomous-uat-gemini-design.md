# Design Specification: AI Autonomous UAT with Gemini API for CAMMS

- **Author:** Antigravity AI Pair Programmer
- **Date:** 2026-10-30
- **Status:** Approved (Pending Implementation Plan)
- **Target System:** CAMMS (Center Asset & Material Management System)

---

## 1. Overview & Objective

The objective of this project is to implement an **Autonomous AI User Acceptance Testing (UAT) Subsystem** powered by the **Google Gemini API** (`gemini-2.5-flash`) and **Playwright**.

Instead of only running rigid, hard-coded E2E test scripts, this autonomous agent acts as a realistic human tester:
1. **Hybrid Execution Paradigm:**
   - **Phase 1 (Goal-Driven Scenario UAT):** Executes formal business acceptance criteria across all three CAMMS roles (**Admin**, **Staff**, **Viewer**) and verifies RBAC boundary enforcements.
   - **Phase 2 (Exploratory Bug Hunting):** Autonomously explores target pages, testing edge cases (e.g. Thai Unicode strings, missing required inputs, boundary parameters) and identifying visual/UX anomalies.
2. **Deterministic & Token-Efficient Perception:**
   - Uses a compact **DOM Accessibility Tree** and interactive element mapping rather than raw coordinate clicking.
   - Drives browser actions via **Playwright Function Calling** (`click_element`, `fill_input`, `select_option`, `navigate_to`, `assert_condition`, `complete_goal`).
3. **Comprehensive Evidence Reporting:**
   - Produces a single-file, self-contained **Interactive HTML Report** with executive metrics, step-by-step reasoning logs, screenshots with zoom modals, defect classifications, and browser console captures.
   - Outputs a concise **Markdown Summary** suitable for GitHub PRs, release reviews, and CI logs.

---

## 2. Architecture & File Structure

The AI UAT subsystem lives in `scripts/ai-uat/`, completely decoupled from production application runtime code:

```text
scripts/ai-uat/
├── run.ts                 # CLI Entry point (supports --headed, --role, --scenario flags)
├── config.ts              # Configuration (Gemini model, timeouts, max steps, base URL)
├── gemini-client.ts       # Gemini API client wrapper with Function Calling tool definitions
├── dom-extractor.ts       # Extracts compact Accessibility Tree & interactive element index
├── agent-driver.ts        # Autonomous execution loop with safety guardrails
├── scenarios/             # Scenario definitions categorized by role
│   ├── types.ts           # TypeScript interfaces for scenarios, steps, and results
│   ├── admin.scenarios.ts # Admin scenarios (Item lifecycle, User mgmt, Export)
│   ├── staff.scenarios.ts # Staff scenarios (Item add/edit, RBAC boundary check)
│   └── viewer.scenarios.ts# Viewer scenarios (Read-only browsing, Mutation rejection)
└── reporter/
    ├── template.html      # Self-contained HTML template styled with Sarabun & CAMMS design
    └── report-builder.ts  # Compiles timeline, screenshots, AI reasoning into HTML & MD
```

### NPM Script Integration
```json
{
  "scripts": {
    "test:uat:ai": "tsx scripts/ai-uat/run.ts",
    "test:uat:ai:headed": "tsx scripts/ai-uat/run.ts --headed",
    "test:uat:ai:admin": "tsx scripts/ai-uat/run.ts --role admin",
    "test:uat:ai:staff": "tsx scripts/ai-uat/run.ts --role staff",
    "test:uat:ai:viewer": "tsx scripts/ai-uat/run.ts --role viewer"
  }
}
```

---

## 3. Gemini Perception & Action Loop

### 3.1 Perception: Compact DOM Accessibility Representation
To optimize context window usage and prevent hallucinated clicks, `dom-extractor.ts` serializes the active viewport into a structured index:

```text
Current URL: /items/new
Active Role: Staff
Interactive Elements:
[#1] button "ย้อนกลับ"
[#2] input[name="asset_number"] "เลขทะเบียนพัสดุ *" (value: "")
[#3] input[name="name"] "ชื่อพัสดุ *" (value: "")
[#4] select[name="category_id"] "หมวดหมู่พัสดุ" (selected: "ครุภัณฑ์สำนักงาน")
[#5] input[name="cost"] "ราคาต้นทุน (บาท)" (value: "")
[#6] button[type="submit"] "บันทึกข้อมูล"
```

Simultaneously, a full-page screenshot is captured at each milestone step for evidence and visual defect detection.

### 3.2 Action: Function Calling Tool Schemas
Gemini receives a tool declarations schema defining the allowable operations:

1. `click_element(id: number, reason: string)`
   - Clicks an element matched by its unique reference number `[#id]`.
2. `fill_input(id: number, value: string, reason: string)`
   - Fills an input or textarea with Thai-safe, NFC-normalized text.
3. `select_option(id: number, option_value: string, reason: string)`
   - Selects an option from a native or custom dropdown.
4. `navigate_to(url: string, reason: string)`
   - Navigates directly to an internal route (e.g. `/admin`, `/items`).
5. `assert_condition(assertion: string, passed: boolean, observation: string)`
   - Records an explicit assertion check in the test log.
6. `complete_goal(status: "PASS" | "FAIL", summary: string, visual_defects: string[])`
   - Terminates the current scenario and records the final outcome.

### 3.3 Guardrails & Safety Controls
* **Step Limit:** Maximum 15 steps per scenario. If the goal is not reached within 15 steps, the scenario fails with a timeout diagnosis.
* **Stagnation Detection:** If DOM state and URL remain identical for 3 consecutive steps despite actions, the loop aborts to prevent infinite loops.
* **Thai Unicode Safety:** Input text is sanitized and normalized using `String.prototype.normalize('NFC')` before keystroke emulation.
* **Database Isolation:** Testing runs against the staging environment (`http://localhost:3001` or `http://localhost:3000`) using pre-seeded staging accounts.

---

## 4. Test Scenarios Specification

### Phase 1: Goal-Driven Scenarios

#### Role 1: Admin (`admin.scenarios.ts`)
* **TC-ADM-01 (Dashboard & KPIs):**
  - *Goal:* Verify that the Dashboard loads successfully, displaying active inventory KPI cards, cumulative depreciation, and category charts.
  - *Success Criteria:* Page contains "ภาพรวมพัสดุ", all 4 KPI metrics are populated, no NaN or error states.
* **TC-ADM-02 (Item Lifecycle CRUD):**
  - *Goal:* Create a new asset (with Thai name, serial number, cost), search for it in `/items`, edit its specification, and delete it with modal confirmation.
  - *Success Criteria:* Item created successfully, visible in table, edited state reflected, item removed upon deletion.
* **TC-ADM-03 (Admin Operations & Self-Protection):**
  - *Goal:* Navigate to `/admin/users`, verify the user list is rendered, and ensure the active admin account cannot be demoted or deleted.
  - *Success Criteria:* Action buttons for current admin are disabled or self-delete is rejected with an error alert.
* **TC-ADM-04 (Report Export):**
  - *Goal:* Navigate to `/reports` and trigger Excel export.
  - *Success Criteria:* Successful file download trigger response received.

#### Role 2: Staff (`staff.scenarios.ts`)
* **TC-STF-01 (Item Creation & Updating):**
  - *Goal:* Add an item under standard Thai category 7110/7440 and update its serial number.
  - *Success Criteria:* Item saved and appears in staff inventory list.
* **TC-STF-02 (RBAC Boundary Enforcement):**
  - *Goal:* Confirm that the delete button is absent from item detail/table views, and navigating directly to `/admin` results in access denied (403 or redirect).
  - *Success Criteria:* Delete action does not exist; access to `/admin` is blocked.
* **TC-STF-03 (Search & Filter Collation):**
  - *Goal:* Search items using Thai keywords with vowels and tone marks (e.g. "โต๊ะทำงาน", "คอมพิวเตอร์").
  - *Success Criteria:* Filtered table accurately matches results according to Thai collation.

#### Role 3: Viewer (`viewer.scenarios.ts`)
* **TC-VIW-01 (Read-Only Registry & Dashboard):**
  - *Goal:* Browse dashboard and asset registry.
  - *Success Criteria:* All views render in read-only mode with accurate data.
* **TC-VIW-02 (Mutation Protection):**
  - *Goal:* Confirm "Add Item" button is hidden. Navigating to `/items/new` or `/admin` must be rejected immediately.
  - *Success Criteria:* Direct URL access redirects to safe view; no mutations possible.

### Phase 2: Exploratory Bug Hunting
For each visited module, the agent performs an exploratory sub-routine (3–5 steps):
* **Thai Edge Cases:** Entering extreme character lengths, stacked vowels, zero-width characters.
* **Form Validation:** Submitting empty required fields, negative costs, invalid date ranges.
* **Visual Anomaly Check:** Evaluating rendered screenshots for overlapping text, broken Sarabun fonts, or clipping.

---

## 5. Reporting System

### 5.1 Interactive HTML Report (`test-results/uat/index.html`)
A single-file HTML report styled with Tailwind-inspired CSS and Sarabun typography:
1. **Executive Metrics Bar:**
   - Overall Readiness Score (%)
   - Total Scenarios, Passed, Failed, Observations
   - Test execution duration and timestamp
2. **Role Breakdown Cards:**
   - Individual progress bars and pass rates for Admin, Staff, and Viewer
3. **Step-by-Step Interactive Accordion:**
   - Expandable scenarios showing the complete timeline
   - AI Reasoning (Thought process in Thai)
   - Action executed with target element details
   - Screenshot preview with click-to-zoom modal
4. **Defects & Anomalies Catalog:**
   - Categorized by severity: `Critical` (Break/Security), `Major` (Functional), `Minor/UX` (Layout/Typography)
   - Visual screenshot evidence and AI recommendation in Thai
5. **Console & Network Error Log:**
   - Uncaught browser exceptions and warning messages captured during runs

### 5.2 Markdown Summary (`test-results/uat/SUMMARY.md`)
A concise Markdown document containing:
- Test execution metadata (date, duration, model used)
- Results summary table (Scenario ID, Role, Description, Status, Duration)
- Highlighted defects and recommended actions

---

## 6. Environment & Configuration

* **Gemini API Key:** Read securely from `.env.local` or environment variable `GEMINI_API_KEY`.
* **Model:** Default to `gemini-2.5-flash` for high throughput and accurate tool-calling.
* **Auth Storage:** Utilizes existing pre-authenticated state files in `tests/e2e/staging/.auth/` (`admin.json`, `staff.json`, `viewer.json`), falling back to automated login if states do not exist.
