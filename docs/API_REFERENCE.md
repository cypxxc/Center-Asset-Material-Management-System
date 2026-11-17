# CAMMS API Reference

> **Base URL:** `/api`  
> **Authentication:** Session cookie `camms_session` (HTTP-only, Lax, Secure in production)  
> **Content-Type:** `application/json` (unless streaming binary files or SSE)

---

## 1. HTTP Route Handlers

### 1.1 Server-Sent Events (SSE)
- **Path:** `GET /api/events`
- **Source:** [app/api/events/route.ts](file:///D:/Center-Asset-Material-Management-System-main/app/api/events/route.ts)
- **Authentication:** Required (`camms_session`).
- **Query Parameters:**
  - `tables` (string): Comma-separated list of tables to listen for (e.g. `items,materials,disbursements`).
  - `clientId` (string, optional): Client connection identifier.
- **Response:** `text/event-stream`
- **Events Emitted:**
  ```json
  event: change
  data: {"table":"items","action":"update","id":"3a10...","timestamp":"2026-11-17T..."}
  ```

---

### 1.2 Private Authenticated Image Streaming
- **Path:** `GET /api/files/[...path]`
- **Source:** [app/api/files/[...path]/route.ts](file:///D:/Center-Asset-Material-Management-System-main/app/api/files/[...path]/route.ts)
- **Authentication:** Required (`camms_session`).
- **Path Parameters:**
  - `path`: Array of segments matching `item-images/[userId]/[filename]`.
- **Security Protections:**
  - Rejects path traversal sequences (`..`), nul characters, and foreign directory roots.
  - Queries `public.inventory_items` to verify the requested image URL is currently attached to an active, non-deleted inventory item.
- **Response:** Binary image stream (`image/webp`, `image/jpeg`, `image/png`) with `Cache-Control: private, max-age=86400, immutable`.

---

### 1.3 System Health Endpoints
- **Source:** [app/api/health/](file:///D:/Center-Asset-Material-Management-System-main/app/api/health/) & [lib/health.ts](file:///D:/Center-Asset-Material-Management-System-main/lib/health.ts)
- **Authentication:** None (Public / Orchestration monitoring).

#### `GET /api/health/liveness`
- Checks whether the Node process is running.
- **Response (200 OK):**
  ```json
  { "alive": true, "uptime": 1420, "timestamp": "2026-11-17T..." }
  ```

#### `GET /api/health/readiness`
- Concurrently checks:
  1. PostgreSQL database connectivity (`SELECT 1 FROM public.profiles LIMIT 1`).
  2. Local storage write access (`LOCAL_STORAGE_PATH` permissions).
  3. Environment variables completeness (`getMissingEnvVars`).
- **Response (200 OK when ready / 503 Service Unavailable when down):**
  ```json
  {
    "ready": true,
    "checks": {
      "database": { "status": "up", "latencyMs": 4 },
      "storage": { "status": "up", "latencyMs": 1 },
      "environment": { "status": "up" }
    },
    "timestamp": "2026-11-17T..."
  }
  ```

#### `GET /api/health/status`
- Returns system runtime metrics, platform, Node version, and memory usage.

---

### 1.4 Cache Revalidation
- **Path:** `POST /api/revalidate`
- **Source:** [app/api/revalidate/route.ts](file:///D:/Center-Asset-Material-Management-System-main/app/api/revalidate/route.ts)
- **Authentication:** Header `x-revalidate-secret` matching `REVALIDATION_SECRET`.
- **Body:** `{ "path": "/items", "type": "page" }`

---

### 1.5 Security Reporting
- **Path:** `GET /.well-known/security.txt`
- **Source:** [app/.well-known/security.txt/route.ts](file:///D:/Center-Asset-Material-Management-System-main/app/.well-known/security.txt/route.ts)
- **Specification:** RFC 9116 compliant security contact endpoint.

---

## 2. Server Actions API

Server Actions serve as the primary mutation interface for React 19 Client Components. All actions run with server-enforced authentication and transaction isolation.

### 2.1 Durable Assets Actions ([features/items/postgres-actions.ts](file:///D:/Center-Asset-Material-Management-System-main/features/items/postgres-actions.ts))

```typescript
// Insert a new durable asset
export async function insertPostgresItem(
  data: ItemFormValues
): Promise<{ data?: { id: string }; error?: { message: string } }>

// Update an existing durable asset
export async function updatePostgresItem(
  id: string,
  data: ItemFormValues
): Promise<{ success: boolean; error?: { message: string } }>

// Soft-delete an asset (sets deleted_at = now())
export async function deletePostgresItem(
  id: string
): Promise<{ success: boolean; error?: string }>

// Bulk update multiple assets (e.g. status, category, location)
export async function bulkUpdatePostgresItems(
  ids: string[],
  updates: Partial<ItemFormValues>
): Promise<{ success: boolean; updatedCount: number; error?: string }>
```

---

### 2.2 Consumable Materials Actions ([features/materials/](file:///D:/Center-Asset-Material-Management-System-main/features/materials/))

```typescript
// Save material registry metadata (supports optimistic locking via metadata_version)
export async function saveMaterialInline(
  id: string | null,
  state: MaterialActionState | null,
  form: FormData
): Promise<MaterialActionState>

// Material stock adjustment (Receipt, Stock Count, Return)
export async function submitStockDocument(
  input: StockDocumentInput
): Promise<{ success: boolean; documentId?: string; error?: string }>
```

---

### 2.3 Disbursement & Requisition Actions ([features/disbursements/postgres-actions.ts](file:///D:/Center-Asset-Material-Management-System-main/features/disbursements/postgres-actions.ts))

```typescript
// Create draft disbursement (material_issue, asset_handover, asset_borrow)
export async function createPostgresDisbursementDraft(
  rawInput: unknown
): Promise<{ id: string }>

// Update line items or details in an existing draft
export async function updatePostgresDisbursementDraft(
  id: string,
  rawInput: unknown
): Promise<{ id: string }>

// Submit draft -> pending_approval (Enforces Rule 0009: immediately cuts material stock)
export async function submitPostgresDisbursementDraft(
  id: string
): Promise<{ success: boolean }>

// Approve and confirm disbursement (Admin only)
export async function confirmPostgresDisbursement(
  id: string,
  dueDate?: string
): Promise<{ success: boolean }>

// Cancel draft or pending request (Refunds material stock if cancelled while pending)
export async function cancelPostgresDisbursement(
  id: string,
  reason?: string
): Promise<{ success: boolean }>

// Reject pending request (Admin only; refunds material stock)
export async function rejectDisbursement(
  id: string,
  reason: string
): Promise<{ success: boolean }>

// Accept item return from borrower (Updates returned_qty & custody condition)
export async function returnPostgresDisbursementItem(
  disbursementId: string,
  rawInput: unknown
): Promise<{ success: boolean }>

// Reverse an already confirmed disbursement (Restores stock/custody with reason)
export async function reversePostgresDisbursement(
  id: string,
  reason: string
): Promise<{ success: boolean }>
```

---

### 2.4 Administrative Actions ([features/admin/postgres-admin.ts](file:///D:/Center-Asset-Material-Management-System-main/features/admin/postgres-admin.ts))

```typescript
// Export complete business data snapshot as JSON (Excludes credentials & sessions)
export async function pgExportDatabaseData(): Promise<{
  backup: BusinessBackup | null;
  error?: string;
}>

// Atomically restore business data from snapshot (Rolls back completely on any FK failure)
export async function pgImportDatabaseData(
  source: string
): Promise<{
  success?: boolean;
  tablesRestored?: string[];
  error?: string;
}>

// Update user role or active status (Enforces last-admin protection advisory lock)
export async function pgUpdateUserProfile(
  userId: string,
  raw: { role?: 'admin' | 'user'; is_active?: boolean; full_name?: string }
): Promise<{ success?: boolean; error?: string; profile?: Record<string, unknown> }>
```

---

## 3. Model Context Protocol (MCP) Tool Specifications

CAMMS exposes a standard STDIO MCP server for AI coding assistants via `npm run mcp`:

| Tool Name | Description | Write Guard Required | Input Schema |
| :--- | :--- | :--- | :--- |
| `list_items` | Paginated query of items and materials | No (Read-only) | `{ q?: string, page?: number, pageSize?: number }` |
| `get_item` | Fetch complete inventory record by UUID | No (Read-only) | `{ id: string (UUID) }` |
| `create_item` | Insert new inventory item into registry | **Yes** (`CAMMS_MCP_ALLOW_WRITE=true`) | Zod `itemFormSchema` |
| `update_item` | Update existing inventory item fields | **Yes** (`CAMMS_MCP_ALLOW_WRITE=true`) | `{ id: string, ...updates }` |
| `delete_item` | Soft-delete inventory item | **Yes** (`CAMMS_MCP_ALLOW_WRITE=true`) | `{ id: string (UUID) }` |
