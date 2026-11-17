# Session timeout implementation plan

**Goal:** Show an accessible timeout popup and automatically log out, retaining the eight-hour server session lifetime.

**Design:** Use an eight-hour idle timer and retain the 60-second warning. The user clarified that logout should occur after eight hours, removing the former 30-minute idle limit. Render the warning as a native modal dialog in the browser top layer above the native item form. At expiry, block continued use, announce expiry for 1.5 seconds, then navigate through the existing server logout route, which deletes the session and HttpOnly cookie before redirecting to login. Do not race the logout route with a redirecting server action. Synchronize expiry across tabs, including storage-only environments. Server session expiry remains eight hours from login; client activity never extends it. Pass that absolute deadline to the client without a separate database query.

**Confirmed:** The user clarified “8 ชั่วโมงแล้วค่อยเด้งออก”; no 30-minute logout.

**Execution:** Inline using executing-plans. Scope is the timeout component and regression tests; preserve unrelated workspace edits.

- [x] Add failing tests for automatic expiry, popup portal, return from sleeping tabs, and cross-tab logout.
- [x] Repair logout guard and use the server logout route after displaying expiry.
- [x] Make the popup accessible above existing dialogs; maintain explicit continue action before expiry.
- [x] Run component tests, full suite, lint, typecheck, build; request review.
- [x] Restart the local production server with the verified build and check HTTP responses.

## Validation and review

- Ten relevant tests pass (eight timeout component cases, layout concurrency, logout route contract).
- Real Chromium verifies top-layer visibility above the native item modal, interaction while body pointer events are disabled by another modal, continue, and automatic logout navigation.
- Lint, typecheck, production build and bundle budget pass.
- Full `npm test` stops on unrelated `components/ui/image-crop-dialog.test.tsx`: both tests fail with `React is not defined`. This workspace already contained image crop edits; left unchanged.
- Independent review found native top-layer and inherited pointer-events issues. Both fixed and verified; reviewer reports no remaining blockers.
- Fixed logout redirect to use relative Location so standalone bind address `0.0.0.0` cannot replace the browser IP.
- Production restarted on `0.0.0.0:3000`. Login and sampled JavaScript return 200. Logout returns 307 to `/login?reason=idle_timeout` and expires the session cookie.
