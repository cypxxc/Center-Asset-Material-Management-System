# Login System Name Design

## Goal

Restore a clear system identifier on the minimal CAMMS login page without reintroducing decorative login-page content.

## Interface

- Display `CAMMS Portal` centered above the existing credential form.
- Use a small, semibold product heading (16px) with the existing foreground color.
- Keep the username input, password input, and submit button unchanged.
- Do not add a logo, subtitle, card, border, icon, animation, or supporting copy.

## Behavior and Accessibility

- Render the system name as the page heading.
- Preserve the existing login action, pending state, validation, error display, and responsive width.

## Verification

- Confirm the heading is visible above the form.
- Confirm the default page otherwise remains limited to the heading, two fields, and the submit button.
- Update the focused component test and run it, TypeScript checking, and ESLint.

## Out of Scope

- Authentication changes
- New branding assets
- Changes outside the login page and its focused test
