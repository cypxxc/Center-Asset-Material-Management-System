# Registry-S Supabase Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty legacy `inve` database schema with a secure Registry-S backend and restore working test login.

**Architecture:** Supabase Auth owns identities. A UUID-based `profiles` table provides application roles; RLS policies rely on a private, security-definer role helper. Server-side actions retain service-role access while browser and server reads are protected by RLS.

**Tech Stack:** Supabase Postgres, Supabase Auth, Supabase Storage, Next.js 16, TypeScript.

---

### Task 1: Baseline and destructive safety check

**Files:**
- Create: `db/migrations/00005_replace_legacy_inve_schema.sql`
- Test: Supabase SQL assertions through the management API

- [ ] Confirm all legacy tables have zero rows and record their structures.
- [ ] Verify the target project is `qrlwduggtczovaebukdp` (`inve`).
- [ ] Drop only `categories`, `item_images`, `items`, `activity_logs`, `error_logs`, `users`, and `item_sequences` after the zero-row check.

### Task 2: Create the Registry-S data model and RLS

**Files:**
- Create: `db/migrations/00005_replace_legacy_inve_schema.sql`

- [ ] Create UUID-based Registry-S tables, foreign-key indexes, item search indexes, timestamps, and the private role helper.
- [ ] Enable RLS and grant only authenticated access required by the policies.
- [ ] Create the private `item-images` bucket and role-aligned Storage policies.

### Task 3: Seed identities and reference data

**Files:**
- Modify: `db/seed.sql`

- [ ] Create confirmed Auth identities for Admin, Staff, and Viewer with email confirmation.
- [ ] Update their profiles to the required roles after the safe default-viewer trigger creates profiles.
- [ ] Insert idempotent categories, locations, and units.

### Task 4: Wire and verify the app

**Files:**
- Modify: `.env.local`

- [ ] Retrieve the project URL and a non-disabled publishable key from Supabase.
- [ ] Verify the existing service-role key with an admin query before preserving it.
- [ ] Restart Next.js and verify password login and the dashboard profile lookup.
