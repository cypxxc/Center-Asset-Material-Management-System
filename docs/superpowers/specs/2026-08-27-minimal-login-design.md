# Minimal Login Page Design

## Goal

Reduce the CAMMS login page to the smallest practical credential form. The page should feel neutral and familiar, with no decorative or explanatory content competing with the task.

## Scope

Change only the presentation and client-side interaction of `app/(auth)/login/page.tsx`. Keep the existing `login` server action, credential field names, redirect behavior, SSO callback error handling, and authentication rules unchanged.

## Interface

- Center one narrow form vertically and horizontally on a plain, light background.
- Show three visible controls only: a username input, a password input, and a submit button.
- Use the Thai placeholders `ชื่อผู้ใช้` and `รหัสผ่าน` inside the inputs.
- Label the submit button `เข้าสู่ระบบ`.
- Remove the logo, product name, heading, supporting copy, security badge, footer, icons, ambient gradients, glass effect, decorative card, password visibility toggle, and page-load animation.
- Do not place the form in a visually separate card or bordered panel.
- Use the existing Sarabun-based product typography and restrained blue focus/action color.
- Keep the form narrow enough for comfortable desktop use and fluid enough to fit small mobile screens.

## Accessibility and Interaction

- Give both inputs programmatic labels that are visually hidden, so the visible interface still contains only placeholders and controls.
- Preserve appropriate `autocomplete`, capitalization, spellcheck, input type, and required attributes.
- Provide a visible keyboard focus state with sufficient contrast.
- Disable the submit button while authentication is pending and change its text to `กำลังเข้าสู่ระบบ...`.
- Do not add decorative motion.

## Error Handling

Authentication and callback failures remain visible near the form because hiding them would leave users unable to understand why login failed. Present each error as concise Thai text using an accessible `role="alert"`. Error content may temporarily add visible text to the page only when an error exists.

## Data Flow

The form continues to submit `id` and `password` to the existing `login` server action through `useActionState`. No server, database, Supabase, permission, or session behavior changes.

## Verification

- Confirm the default page visibly contains only two inputs and one submit button.
- Confirm both placeholders and the button text are correct in Thai.
- Confirm password content is masked.
- Confirm keyboard focus and form submission work.
- Confirm pending and error states remain understandable.
- Run the relevant component tests if present, then run `npm run typecheck` and `npm run lint`.
- Inspect the page at desktop and mobile widths after implementation.

## Out of Scope

- Authentication logic changes
- SSO behavior changes
- Password recovery or account creation
- New branding, illustrations, or animations
- Changes to other portal pages
