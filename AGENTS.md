<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

## 📚 บังคับ: อ่าน Context ก่อนทำงานทุกครั้ง

**ทุก agent ต้องอ่านไฟล์ต่อไปนี้ก่อนเริ่มงาน (ตามลำดับ):**

1. [`docs/context/PRODUCT.md`](docs/context/PRODUCT.md) — ข้อมูลผลิตภัณฑ์, ผู้ใช้, ขอบเขต และทิศทางการออกแบบ
2. [`docs/context/README.md`](docs/context/README.md) — ภาพรวมโปรเจกต์, การติดตั้ง, โครงสร้าง
3. [`docs/context/AGENTS.md`](docs/context/AGENTS.md) — กฎ Next.js และ workflow สำหรับ agents

> **ไม่อ่านก่อน = ไม่เริ่มงาน**

---

## CAMMS maintenance workflow

For requests to audit CAMMS, investigate slowness, fix security issues, clean unused code, or add regression coverage, read [camms-maintenance](.agents/skills/camms-maintenance/SKILL.md). Apply only the requested scope; an ordinary feature change does not require a whole-system audit.

Example invocation in Codex:

> Use $camms-maintenance to inspect CAMMS, find the causes of slowness, fix evidenced performance and security issues, remove verified unused code, add regression tests, and summarize the changes and validation. Leave changes on a separate branch for review.

---

## 📁 โครงสร้าง Docs

```
docs/
├── context/          ← ไฟล์ context หลักสำหรับ agents (อ่านก่อนทุกครั้ง)
│   ├── PRODUCT.md    ← ข้อมูลผลิตภัณฑ์และขอบเขตงาน
│   ├── README.md     ← ภาพรวมโปรเจกต์และวิธีติดตั้ง
│   ├── AGENTS.md     ← กฎ Next.js สำหรับ agents
│   └── CLAUDE.md     ← Claude-specific agent rules
├── cleanup/          ← เอกสารการ cleanup โค้ด
├── postgres/         ← เอกสาร PostgreSQL
├── production/       ← เอกสาร production deployment
├── release-review/   ← เอกสาร release review
└── superpowers/      ← แผนงานและ specs จาก superpowers sessions
    ├── plans/
    └── specs/
```
