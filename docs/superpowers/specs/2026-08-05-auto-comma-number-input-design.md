# Auto-Comma Number Input Formatting Design

## Overview
Implement real-time automatic comma formatting (e.g. `10,000` or `12,500.50`) for numeric input fields in CAMMS, specifically for `quantity` and `unit_price` within the Item Form (`features/items/components/item-form.tsx`).

## Requirements
1. **Real-time Formatting**: Automatically format numeric input with thousands separators (`,`) as the user types.
2. **Integer vs Decimal Support**:
   - `quantity`: Integer only (no decimals, min 1).
   - `unit_price`: Decimal support up to 2 decimal places (min 0).
3. **Cursor Preservation**: Ensure cursor position does not jump erratically when commas are added or removed during typing.
4. **Form Submission & Validation**:
   - Ensure `FormData` submitted by HTML `<form>` contains clean numeric values or handles comma stripping seamlessly.
   - Update `features/items/schema.ts` `z.preprocess` for `quantity` and `unit_price` to strip commas `.replace(/,/g, '')` before type coercion.

## Component Architecture

### `FormattedNumberInput` (`components/ui/formatted-number-input.tsx`)
- Reusable React component wrapping standard `<input type="text" inputMode="decimal" />`.
- Manages local formatted display value state while syncing with `defaultValue` / `value`.
- Props:
  - `name`: string (e.g. `'quantity'`, `'unit_price'`)
  - `id`: string
  - `defaultValue`: number | string | null
  - `allowDecimals`: boolean (default: false)
  - `required`: boolean
  - `min`: number
  - `step`: string | number
  - `placeholder`: string
  - `aria-invalid`: boolean
- Form Submission Helper: Include a hidden `<input name={name} value={rawValue} />` if required, or clean formatted string directly.

## Schema Changes (`features/items/schema.ts`)
- In `itemFormSchema`:
  - `quantity`: preprocess string by removing `,` before `z.coerce.number()`.
  - `optionalUnitPrice`: preprocess string by removing `,` before `z.coerce.number()`.

## Testing Plan
- Unit test `FormattedNumberInput` formatting utilities (e.g. `formatWithCommas('10000')` => `'10,000'`).
- Unit test `itemFormSchema` accepts strings with commas like `'10,000'` for `quantity` and `'12,500.50'` for `unit_price`.
- Component test `ItemForm` renders formatted values.
- Verify full test suite passes with `npm test`.
