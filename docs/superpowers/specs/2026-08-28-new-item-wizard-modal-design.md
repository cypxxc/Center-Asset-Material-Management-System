# New Item Wizard Modal Design

## Goal

Redesign the in-context new-item modal as a two-step wizard that makes the required registration data easy to complete while preserving the existing inline creation, draft, authorization, and audit behavior.

## Scope

- Keep item creation within the existing native dialog opened from the item explorer.
- Split the form into two in-modal steps with a persistent progress indicator and footer actions.
- Preserve local draft storage and the existing `createItemInline` action.
- Make the mobile dialog use near-full viewport height while keeping the footer visible.

## Non-Goals

- Do not change item schema, server actions, roles, RLS, audit payloads, or asset-number rules.
- Do not change the standalone `/items/new` route.
- Do not add autosave to the server or new persistence for drafts.

## Wizard Structure

### Step 1: Main information

Step 1 is titled `ข้อมูลหลัก` and shows progress `1 จาก 2`. It contains the data needed to identify and register an item:

- Item name
- Item type
- Quantity
- Unit
- Category
- Location

Item name, type, quantity, and unit use the existing required-field rules. Category and location remain optional. The primary action is `ถัดไป`.

### Step 2: Additional details

Step 2 is titled `รายละเอียดเพิ่มเติม` and shows progress `2 จาก 2`. It includes asset number, serial number, brand, model, responsible person, unit price, image, note, and depreciation fields. These retain their current validation and conditional behavior. The footer exposes `ย้อนกลับ`, `บันทึกร่าง`, and `เพิ่มรายการ`.

## Behavior

- Moving to Step 2 validates only the required Step 1 controls. If invalid, the wizard stays on Step 1, displays existing field errors, and focuses the first invalid control.
- Moving back preserves all entered values.
- Form submission continues to run the existing complete server validation and `createItemInline` action. Submission errors keep the user on the relevant step and preserve data.
- Draft restoration, draft updates, dirty-close confirmation, Escape handling, and backdrop handling retain their current localStorage behavior.
- Successful creation clears the draft, closes the dialog, and invokes the existing list refresh callback.

## Layout and Accessibility

- The dialog remains a native `<dialog>` with its existing backdrop and close affordances.
- Header contains title, short step label/progress, and close button.
- The scrollable body contains only the active step; the action footer is visually persistent below it.
- On mobile, the panel is near-full height and width with the body scrolling independently from the footer.
- Step controls use semantic buttons, visible focus states, and accessible labels. The active step is announced through an accessible progress label.

## Component Boundaries

- `NewItemSheet` owns dialog lifecycle, draft lifecycle, current step, step navigation, and the shell/footer.
- `ItemForm` remains the source of fields, validation display, input normalization, and submission wiring. It receives a step/display boundary rather than duplicating form fields in the sheet.
- Server actions remain unchanged.

## Testing

- Component tests cover initial step, successful forward navigation, invalid Step 1 gate, backward navigation with preserved values, draft restoration, and persistent footer layout contract.
- Existing `createItemInline` integration tests continue to verify authorization, validation, telemetry, audit, and result behavior.
- Run typecheck, lint, unit/component tests, build, and browser smoke tests before release.

## Acceptance Criteria

- Users cannot reach Step 2 with invalid required Step 1 data.
- Users can return to Step 1 without losing entered values.
- Existing drafts restore correctly into the wizard.
- Successful item creation has the same server-side and list-refresh behavior as today.
- The wizard is fully operable by keyboard and remains usable on mobile screens.
