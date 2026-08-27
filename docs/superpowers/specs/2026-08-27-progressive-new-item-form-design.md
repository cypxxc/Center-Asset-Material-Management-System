# Progressive New Item Form Design

## Goal

Make the new-item modal fast to complete for routine office registration while preserving full item detail entry when needed.

## Interface

- Keep required core fields visible: item type, name, quantity, unit, location, and status.
- Put asset identifiers, brand, model, image, and notes in a collapsed `รายละเอียดเพิ่มเติม` section.
- Remove the explanatory banner and long subtitle.
- Use accessible item-type tabs with keyboard semantics.

## Behavior

- The modal cancel action closes the modal without navigation.
- Closing a dirty form explains that the draft is saved automatically and can be resumed.
- Validation errors appear within the form rather than in a nested modal.
- Keep the existing create action, validation, draft storage, image crop/upload, and success behavior.

## Verification

- Test modal cancellation, draft copy, tab semantics, expanded details, validation display, and successful creation.
- Run TypeScript and ESLint checks.
